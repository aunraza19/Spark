import hashlib
import json
import shutil
from pathlib import Path

import pytest
from spark_data.adapters import ADAPTERS
from spark_data.build import build_all, main

REPO = Path(__file__).resolve().parents[1]
INCOMING = REPO / "data" / "incoming"
REFERENCE = REPO / "data" / "reference"
OUTPUTS = ("experiments.json", "test_points.json", "burner_points.json", "build_report.json")


def load(clean, name):
    return json.loads((clean / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def real(tmp_path_factory):
    clean = tmp_path_factory.mktemp("clean")
    report = build_all(INCOMING, REFERENCE, clean)
    return clean, report


def make_incoming(tmp_path, records=(), tables=()):
    incoming = tmp_path / "incoming"
    (incoming / "experiments").mkdir(parents=True)
    (incoming / "test-tables").mkdir()
    for name in records:
        shutil.copy(INCOMING / "experiments" / name, incoming / "experiments" / name)
    for name in tables:
        shutil.copy(INCOMING / "test-tables" / name, incoming / "test-tables" / name)
    return incoming


def test_the_build_writes_all_four_files_and_returns_the_report(real):
    clean, report = real
    for name in OUTPUTS:
        assert (clean / name).is_file()
    assert load(clean, "build_report.json") == report


def test_experiments_file_lists_all_24_as_loaded_without_temperature(real):
    clean, _ = real
    experiments = load(clean, "experiments.json")
    assert len(experiments) == 24
    assert {e["status"] for e in experiments} == {"loaded"}
    assert [e["psi_id"] for e in experiments] == sorted((e["psi_id"] for e in experiments), key=lambda i: int(i[4:]))
    for e in experiments:
        assert e["record"]["psi_id"] == e["psi_id"]
        assert "ambient_temperature_K" not in e["record"]
    assert [e["kind"] for e in experiments].count("flight") == 19


def test_experiments_not_received_show_as_not_loaded(tmp_path):
    incoming = make_incoming(tmp_path, records=["psi-25.json"])
    build_all(incoming, REFERENCE, tmp_path / "clean")
    experiments = {e["psi_id"]: e for e in load(tmp_path / "clean", "experiments.json")}
    assert len(experiments) == 24
    assert experiments["PSI-25"]["status"] == "loaded"
    assert experiments["PSI-10"]["status"] == "not_loaded"
    assert experiments["PSI-10"]["record"] is None


def test_a_record_that_fails_validation_is_left_out_and_listed(tmp_path):
    incoming = make_incoming(tmp_path, records=["psi-25.json"])
    (incoming / "experiments" / "psi-69.json").write_text("{", encoding="utf-8")
    report = build_all(incoming, REFERENCE, tmp_path / "clean")
    experiments = {e["psi_id"]: e for e in load(tmp_path / "clean", "experiments.json")}
    assert experiments["PSI-69"]["status"] == "failed_validation"
    assert experiments["PSI-69"]["record"] is None
    assert [(i["record"], i["rule"]) for i in report["validation_issues"] if i["severity"] == "error"] == [
        ("PSI-69", "invalid_json")
    ]


def test_a_record_missing_from_the_registry_is_a_warning_and_left_out(tmp_path):
    incoming = make_incoming(tmp_path, records=["psi-25.json"])
    record = json.loads((incoming / "experiments" / "psi-25.json").read_text(encoding="utf-8"))
    record["psi_id"] = "PSI-999"
    (incoming / "experiments" / "psi-999.json").write_text(json.dumps(record), encoding="utf-8")
    report = build_all(incoming, REFERENCE, tmp_path / "clean")
    assert ("PSI-999", "not_in_registry") in {(i["record"], i["rule"]) for i in report["validation_issues"]}
    assert "PSI-999" not in {e["psi_id"] for e in load(tmp_path / "clean", "experiments.json")}


def test_table_status_per_experiment(real, tmp_path):
    _, report = real
    status = {e["psi_id"]: e["test_table"] for e in report["experiments"]}
    assert status["PSI-10"] == "loaded"
    assert status["PSI-159"] == "loaded"
    assert status["PSI-60"] == "none_expected"
    incoming = make_incoming(tmp_path, records=["psi-25.json", "psi-10.json"], tables=["PSI-10_Experimental table_Flame Design_Normal Flame.csv"])
    partial = build_all(incoming, REFERENCE, tmp_path / "clean")
    status = {e["psi_id"]: e["test_table"] for e in partial["experiments"]}
    assert status["PSI-25"] == "not_loaded"
    assert status["PSI-10"] == "partial"
    assert status["PSI-69"] == "not_loaded"


def test_point_counts_per_experiment(real):
    _, report = real
    counts = {e["psi_id"]: (e["ambient_points"], e["burner_points"]) for e in report["experiments"]}
    assert counts["PSI-10"] == (207, 109)
    assert counts["PSI-159"] == (179, 154)
    assert counts["PSI-39"] == (79, 0)
    assert counts["PSI-69"] == (273, 0)
    assert counts["PSI-25"] == (129, 0)
    assert counts["PSI-98"] == (2, 0)
    assert counts["PSI-99"] == (9, 0)
    zero = {i for i, c in counts.items() if c == (0, 0)}
    assert zero == {f"PSI-{n}" for n in (20, 21, 22, 23, 26, 47, 60, 62, 68, 100, 101, 102, 106, 107, 115, 117, 142)}
    assert report["summary"]["ambient_points"] == 878
    assert report["summary"]["burner_points"] == 263


def test_tables_with_no_points_print_a_reason(real):
    _, report = real
    tables = {t["file"]: t for t in report["tables"]}
    for file, adapter in ADAPTERS.items():
        if adapter.no_points:
            assert tables[file]["points"] == 0
            assert adapter.no_points in tables[file]["excluded_reasons"]


def test_report_lists_duplicates_exclusions_and_null_fields(real):
    _, report = real
    tables = {t["file"]: t for t in report["tables"]}
    psi39 = tables["PSI-39_Experimental table_CFI.csv"]
    assert len(psi39["duplicates"]) == 8
    assert {"row", "test_id", "first_row"} <= set(psi39["duplicates"][0])
    psi69 = tables["PSI-69_Experimental table_FLEX.csv"]
    assert [(e["test_id"], e["row"]) for e in psi69["excluded_rows"]] == [("114", 115)]
    psi10 = tables["PSI-10_Experimental table_Flame Design_Normal Flame.csv"]
    assert {(n["field"], n["reason"]): n["count"] for n in psi10["null_fields"]} == {
        ("fuel_flow_mg_s", "not a number: 'RAMP'"): 57,
        ("fuel_flow_mg_s", "not a number: 'RAMPED'"): 3,
    }
    assert tables["PSI-159_Experimental table_CFI-G_Inverse Flames.csv"]["blank_rows"] == 861


def test_lunar_zone_is_computed_from_the_data(real):
    _, report = real
    zone = report["lunar_zone"]
    assert zone["definition"] == {"o2_pct_min": 30, "pressure_psi_max": 10.2}
    assert zone["test_points"] == 20
    assert zone["by_experiment"] == {"PSI-159": 20}
    assert zone["report_conditions"] == [{"experiment_id": "PSI-20", "test_id": "19070D1"}]


def test_burner_points_are_not_counted_in_the_lunar_zone(real):
    clean, report = real
    burner_in_zone = [
        p for p in load(clean, "burner_points.json") if p["o2_pct_min"] >= 30 and p["pressure_psi_max"] <= 10.2
    ]
    assert burner_in_zone, "this test needs burner points that would be inside the zone"
    assert report["lunar_zone"]["test_points"] == 20


def test_report_carries_validation_issues_outside_psi_and_open_questions(real):
    _, report = real
    assert {(i["record"], i["rule"]) for i in report["validation_issues"]} == {
        ("PSI-39", "one_sided_range"),
        ("PSI-39", "total_tests_not_a_number"),
        ("PSI-142", "one_sided_range"),
    }
    assert report["outside_psi"] == [
        {"label": label, "status": "outside_psi"} for label in ("SoFIE", "FM2", "Saffire-IV", "Saffire-V", "Saffire-VI")
    ]
    assert [q["experiment"] for q in report["open_questions"]] == ["PSI-21", "PSI-22", "PSI-20", "PSI-26"]


def test_build_is_repeatable_and_does_not_modify_the_input(tmp_path):
    def fingerprint():
        return {
            str(p.relative_to(INCOMING)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in INCOMING.rglob("*") if p.is_file()
        }

    before = fingerprint()
    first, second = tmp_path / "first", tmp_path / "second"
    build_all(INCOMING, REFERENCE, first)
    build_all(INCOMING, REFERENCE, second)
    for name in OUTPUTS:
        assert (first / name).read_bytes() == (second / name).read_bytes()
        assert b"\r" not in (first / name).read_bytes()
    assert fingerprint() == before


def test_main_prints_the_zone_result_and_exits_0(capsys, tmp_path):
    assert main([str(INCOMING), str(tmp_path)]) == 0
    output = capsys.readouterr().out
    assert "20 test points and 1 report condition in the lunar zone" in output
    assert "878 ambient points, 263 burner points" in output
