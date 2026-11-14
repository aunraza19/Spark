import hashlib
import json
import shutil
from collections import Counter
from pathlib import Path

from spark_data.build import build_points, main

INCOMING = Path(__file__).resolve().parents[1] / "data" / "incoming"


def load(clean, name):
    return json.loads((clean / name).read_text(encoding="utf-8"))


def test_points_files_hold_the_expected_counts_per_experiment(tmp_path):
    build_points(INCOMING, tmp_path)
    ambient = load(tmp_path, "test_points.json")
    burner = load(tmp_path, "burner_points.json")
    assert Counter(p["experiment_id"] for p in ambient) == Counter({
        "PSI-10": 207, "PSI-25": 129, "PSI-39": 79, "PSI-69": 273,
        "PSI-98": 2, "PSI-99": 9, "PSI-159": 179,
    })
    assert Counter(p["pressure_basis"] for p in ambient) == Counter({"table": 738, "record": 140})
    assert Counter(p["experiment_id"] for p in burner) == Counter({"PSI-10": 109, "PSI-159": 154})
    assert {p["pressure_basis"] for p in burner} == {"table"}


def test_burner_points_never_appear_in_the_ambient_file(tmp_path):
    build_points(INCOMING, tmp_path)
    ambient = load(tmp_path, "test_points.json")
    assert not any("Inverse" in p["source_file"] for p in ambient)


def test_build_is_repeatable_and_writes_plain_lf_text(tmp_path):
    first, second = tmp_path / "first", tmp_path / "second"
    first.mkdir()
    second.mkdir()
    build_points(INCOMING, first)
    build_points(INCOMING, second)
    for name in ("test_points.json", "burner_points.json"):
        assert (first / name).read_bytes() == (second / name).read_bytes()
        assert b"\r" not in (first / name).read_bytes()


def test_build_does_not_modify_the_input(tmp_path):
    def fingerprint():
        return {
            str(p.relative_to(INCOMING)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in INCOMING.rglob("*") if p.is_file()
        }

    before = fingerprint()
    build_points(INCOMING, tmp_path)
    assert fingerprint() == before


def make_incoming(tmp_path, table_files, record_text=None):
    incoming = tmp_path / "incoming"
    (incoming / "experiments").mkdir(parents=True)
    (incoming / "test-tables").mkdir()
    for name in ("psi-25.json", "psi-69.json"):
        shutil.copy(INCOMING / "experiments" / name, incoming / "experiments" / name)
    if record_text is not None:
        (incoming / "experiments" / "psi-69.json").write_text(record_text, encoding="utf-8")
    for name in table_files:
        shutil.copy(INCOMING / "test-tables" / name, incoming / "test-tables" / name)
    return incoming


def test_a_table_of_an_invalid_record_is_skipped_and_listed(tmp_path):
    incoming = make_incoming(
        tmp_path, ["PSI-69_Experimental table_FLEX.csv", "PSI-25_Experimental table_BASS-II.csv"], "{"
    )
    result = build_points(incoming, tmp_path)
    assert set(result.skipped) == {"PSI-69_Experimental table_FLEX.csv"}
    assert "PSI-69" in result.skipped["PSI-69_Experimental table_FLEX.csv"]
    assert {p["experiment_id"] for p in load(tmp_path, "test_points.json")} == {"PSI-25"}
    assert [i.rule for i in result.issues if i.severity == "error"] == ["invalid_json"]


def test_a_table_with_a_missing_column_is_skipped_and_listed(tmp_path):
    incoming = make_incoming(tmp_path, [])
    name = "PSI-25_Experimental table_BASS-II.csv"
    text = (INCOMING / "test-tables" / name).read_text(encoding="utf-8-sig")
    (incoming / "test-tables" / name).write_text(text.replace("Calibrated  initial O2", "Other"), encoding="utf-8")
    result = build_points(incoming, tmp_path)
    assert "initial O2" in result.skipped[name]
    assert load(tmp_path, "test_points.json") == []
    assert main([str(incoming), str(tmp_path)]) == 1


def test_a_table_without_an_adapter_is_listed_and_not_read(tmp_path):
    incoming = make_incoming(tmp_path, ["PSI-25_Experimental table_BASS-II.csv"])
    (incoming / "test-tables" / "new table.csv").write_text("a,b\n1,2\n", encoding="utf-8")
    result = build_points(incoming, tmp_path)
    assert result.unmatched == ["new table.csv"]
    assert [t.file for t in result.tables] == ["PSI-25_Experimental table_BASS-II.csv"]


def test_main_prints_counts_and_exits_0_for_the_real_data(capsys, tmp_path):
    assert main([str(INCOMING), str(tmp_path)]) == 0
    output = capsys.readouterr().out
    assert "PSI-69" in output
    assert "878 ambient points, 263 burner points" in output


def test_main_exits_1_when_a_record_fails_validation(tmp_path):
    incoming = make_incoming(tmp_path, [], "{")
    assert main([str(incoming), str(tmp_path)]) == 1
