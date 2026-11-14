import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from spark_data.adapters import ADAPTERS, TableResult, read_table
from spark_data.models import Experiment
from spark_data.paths import CLEAN_DIR, INCOMING_DIR
from spark_data.validate import Issue, format_issue, validate_records


@dataclass
class PointsBuild:
    experiments: dict[str, Experiment]
    issues: list[Issue]
    tables: list[TableResult] = field(default_factory=list)
    skipped: dict[str, str] = field(default_factory=dict)
    unmatched: list[str] = field(default_factory=list)


def _order(path: Path) -> tuple[int, str]:
    match = re.match(r"PSI-(\d+)_", path.name)
    return (int(match[1]) if match else 10**6, path.name)


def _write_json(path: Path, data: object) -> None:
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_bytes(text.encode("utf-8"))


def build_points(incoming: Path, clean: Path) -> PointsBuild:
    experiments, issues = validate_records(incoming / "experiments")
    build = PointsBuild(experiments, issues)
    for path in sorted((incoming / "test-tables").glob("*.csv"), key=_order):
        adapter = ADAPTERS.get(path.name)
        if adapter is None:
            build.unmatched.append(path.name)
        elif adapter.experiment not in experiments:
            build.skipped[path.name] = f"{adapter.experiment} record is not valid or not loaded"
        else:
            try:
                build.tables.append(read_table(adapter, path, experiments[adapter.experiment]))
            except ValueError as error:
                build.skipped[path.name] = str(error)
    clean.mkdir(parents=True, exist_ok=True)
    for name, basis in (("test_points.json", "ambient"), ("burner_points.json", "burner")):
        points = [p.model_dump() for t in build.tables if t.basis == basis for p in t.points]
        _write_json(clean / name, points)
    return build


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the clean point files. Changes nothing in incoming.")
    parser.add_argument("incoming", nargs="?", type=Path, default=INCOMING_DIR)
    parser.add_argument("clean", nargs="?", type=Path, default=CLEAN_DIR)
    args = parser.parse_args(argv)
    build = build_points(args.incoming, args.clean)
    for issue in build.issues:
        print(format_issue(issue))
    for table in build.tables:
        print(
            f"{table.experiment} {table.file}: {len(table.points)} points, "
            f"{sum(table.excluded_reasons.values())} excluded, {len(table.duplicates)} duplicates, "
            f"{table.blank_rows} blank"
        )
    for file, reason in build.skipped.items():
        print(f"SKIPPED {file}: {reason}")
    for file in build.unmatched:
        print(f"NO ADAPTER {file}")
    ambient = sum(len(t.points) for t in build.tables if t.basis == "ambient")
    burner = sum(len(t.points) for t in build.tables if t.basis == "burner")
    print(f"{ambient} ambient points, {burner} burner points")
    failed = any(issue.severity == "error" for issue in build.issues) or bool(build.skipped)
    return 1 if failed else 0
