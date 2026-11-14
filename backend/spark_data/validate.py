import argparse
import json
import re
from pathlib import Path
from typing import NamedTuple

from pydantic import ValidationError

from spark_data.models import Experiment
from spark_data.paths import EXPERIMENTS_DIR

_FILE_NAME = re.compile(r"psi-(\d+)\.json")


class Issue(NamedTuple):
    severity: str
    file: str
    record: str | None
    rule: str
    message: str


def _check(path: Path, record: str) -> tuple[Experiment | None, list[Issue]]:
    def issue(severity: str, rule: str, message: str) -> Issue:
        return Issue(severity, path.name, record, rule, message)

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        return None, [issue("error", "invalid_json", str(error))]
    if not isinstance(data, dict):
        return None, [issue("error", "invalid_record", "top level is not an object")]
    try:
        experiment = Experiment.model_validate(data)
    except ValidationError as error:
        return None, [
            issue(
                "error",
                "missing_key" if problem["type"] == "missing" else "wrong_type",
                f"{'.'.join(map(str, problem['loc']))}: {problem['msg']}",
            )
            for problem in error.errors()
        ]

    found: list[Issue] = []
    if experiment.psi_id != record:
        found.append(issue("error", "psi_id_mismatch", f"psi_id is {experiment.psi_id!r}"))
    ranges = (
        ("o2", experiment.o2_min_pct, experiment.o2_max_pct),
        ("pressure", experiment.pressure_min_psi, experiment.pressure_max_psi),
    )
    for quantity, low, high in ranges:
        if (low is None) != (high is None):
            found.append(issue("warning", "one_sided_range", f"{quantity}: only one of min and max is set"))
        elif low is not None and low > high:
            found.append(issue("error", "range_order", f"{quantity}: minimum {low} is above maximum {high}"))
    total = experiment.test_summary.get("total_tests")
    if total is not None and (isinstance(total, bool) or not isinstance(total, int)):
        found.append(issue("warning", "total_tests_not_a_number", f"total_tests is {total!r}, not a whole number"))
    for key in experiment.model_extra or {}:
        found.append(issue("warning", "unexpected_key", f"key {key!r} is not in the format"))
    if any(i.severity == "error" for i in found):
        return None, found
    return experiment, found


def validate_records(directory: Path) -> tuple[dict[str, Experiment], list[Issue]]:
    valid: dict[str, Experiment] = {}
    issues: list[Issue] = []
    for path in sorted(directory.glob("*.json")):
        match = _FILE_NAME.fullmatch(path.name)
        if match is None:
            issues.append(Issue("warning", path.name, None, "unexpected_file", "file name is not psi-<number>.json"))
            continue
        record = f"PSI-{match[1]}"
        experiment, found = _check(path, record)
        issues.extend(found)
        if experiment is not None:
            valid[record] = experiment
    return valid, issues


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check the experiment records. Changes nothing.")
    parser.add_argument("directory", nargs="?", type=Path, default=EXPERIMENTS_DIR)
    valid, issues = validate_records(parser.parse_args(argv).directory)
    for found in issues:
        print(f"{found.severity.upper():7} {found.file} {found.record or '-'} {found.rule}: {found.message}")
    errors = sum(found.severity == "error" for found in issues)
    print(f"{len(valid)} valid, {errors} errors, {len(issues) - errors} warnings")
    return 1 if errors else 0
