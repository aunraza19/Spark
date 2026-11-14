import hashlib
import json
import shutil
from pathlib import Path

import pytest
from spark_data.validate import main, validate_records

EXPERIMENTS = Path(__file__).resolve().parents[1] / "data" / "incoming" / "experiments"
# The 24 experiments listed in the task brief.
EXPECTED_IDS = {
    f"PSI-{n}"
    for n in (10, 20, 21, 22, 23, 25, 26, 39, 47, 60, 62, 68, 69, 98, 99, 100,
              101, 102, 106, 107, 115, 117, 142, 159)
}


def copy_record(tmp_path, number, change=None):
    """Copy one real record into tmp_path, optionally editing the parsed JSON."""
    target = tmp_path / f"psi-{number}.json"
    shutil.copy(EXPERIMENTS / f"psi-{number}.json", target)
    if change is not None:
        record = json.loads(target.read_text(encoding="utf-8"))
        change(record)
        target.write_text(json.dumps(record), encoding="utf-8")
    return target


def errors(issues):
    return [i for i in issues if i.severity == "error"]


def warnings(issues):
    return [i for i in issues if i.severity == "warning"]


def test_real_records_all_24_are_valid():
    valid, issues = validate_records(EXPERIMENTS)
    assert errors(issues) == []
    assert set(valid) == EXPECTED_IDS


def test_real_records_give_exactly_three_warnings():
    _, issues = validate_records(EXPERIMENTS)
    assert {(i.record, i.rule) for i in warnings(issues)} == {
        ("PSI-39", "one_sided_range"),
        ("PSI-39", "total_tests_not_a_number"),
        ("PSI-142", "one_sided_range"),
    }


def test_one_sided_range_warnings_name_the_quantity():
    _, issues = validate_records(EXPERIMENTS)
    messages = {i.record: i.message for i in issues if i.rule == "one_sided_range"}
    assert "o2" in messages["PSI-39"]
    assert "pressure" in messages["PSI-142"]


def test_total_tests_string_is_reported_and_not_changed():
    valid, issues = validate_records(EXPERIMENTS)
    issue = next(i for i in issues if i.rule == "total_tests_not_a_number")
    assert ">200" in issue.message
    assert valid["PSI-39"].test_summary["total_tests"] == ">200"


def test_missing_key_is_an_error_and_leaves_the_record_out(tmp_path):
    copy_record(tmp_path, 25, lambda r: r.pop("fuel_state"))
    valid, issues = validate_records(tmp_path)
    (issue,) = errors(issues)
    assert (issue.file, issue.record, issue.rule) == ("psi-25.json", "PSI-25", "missing_key")
    assert "fuel_state" in issue.message
    assert valid == {}


def test_wrong_type_is_an_error(tmp_path):
    copy_record(tmp_path, 25, lambda r: r.update(o2_min_pct="21"))
    valid, issues = validate_records(tmp_path)
    (issue,) = errors(issues)
    assert issue.rule == "wrong_type"
    assert "o2_min_pct" in issue.message
    assert valid == {}


def test_psi_id_must_match_the_file_name(tmp_path):
    copy_record(tmp_path, 25, lambda r: r.update(psi_id="PSI-26"))
    valid, issues = validate_records(tmp_path)
    (issue,) = errors(issues)
    assert issue.rule == "psi_id_mismatch"
    assert "PSI-26" in issue.message
    assert valid == {}


@pytest.mark.parametrize(
    "change, quantity",
    [
        (lambda r: r.update(o2_min_pct=30, o2_max_pct=20), "o2"),
        (lambda r: r.update(pressure_min_psi=15, pressure_max_psi=14), "pressure"),
    ],
)
def test_minimum_above_maximum_is_an_error(tmp_path, change, quantity):
    copy_record(tmp_path, 25, change)
    valid, issues = validate_records(tmp_path)
    (issue,) = errors(issues)
    assert issue.rule == "range_order"
    assert quantity in issue.message
    assert valid == {}


def test_unexpected_key_is_a_warning_and_the_record_stays(tmp_path):
    copy_record(tmp_path, 25, lambda r: r.update(measured_outputs=[]))
    valid, issues = validate_records(tmp_path)
    assert errors(issues) == []
    (issue,) = warnings(issues)
    assert issue.rule == "unexpected_key"
    assert "measured_outputs" in issue.message
    assert "PSI-25" in valid


def test_particle_size_table_is_a_known_key(tmp_path):
    # PSI-101 is the one real record with this key.
    copy_record(tmp_path, 101)
    valid, issues = validate_records(tmp_path)
    assert issues == []
    assert "PSI-101" in valid


@pytest.mark.parametrize("text, rule", [("{", "invalid_json"), ("[]", "invalid_record")])
def test_unreadable_file_is_an_error_and_others_are_still_checked(tmp_path, text, rule):
    copy_record(tmp_path, 25)
    (tmp_path / "psi-26.json").write_text(text, encoding="utf-8")
    valid, issues = validate_records(tmp_path)
    (issue,) = errors(issues)
    assert (issue.file, issue.rule) == ("psi-26.json", rule)
    assert set(valid) == {"PSI-25"}


def test_json_file_with_another_name_is_a_warning(tmp_path):
    copy_record(tmp_path, 25)
    (tmp_path / "notes.json").write_text("{}", encoding="utf-8")
    valid, issues = validate_records(tmp_path)
    (issue,) = warnings(issues)
    assert (issue.file, issue.rule) == ("notes.json", "unexpected_file")
    assert errors(issues) == []
    assert set(valid) == {"PSI-25"}


def test_validation_does_not_modify_the_input():
    def fingerprint():
        return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in EXPERIMENTS.iterdir()}

    before = fingerprint()
    validate_records(EXPERIMENTS)
    assert fingerprint() == before


def test_main_prints_issues_and_exits_1_on_an_error(tmp_path, capsys):
    copy_record(tmp_path, 25, lambda r: r.pop("fuel_state"))
    assert main([str(tmp_path)]) == 1
    output = capsys.readouterr().out
    assert "PSI-25" in output
    assert "missing_key" in output


def test_main_exits_0_when_there_are_only_warnings(capsys):
    assert main([str(EXPERIMENTS)]) == 0
    output = capsys.readouterr().out
    assert "one_sided_range" in output
    assert "24 valid" in output
