import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from spark_data.adapters import ADAPTERS, TableResult, read_table
from spark_data.models import Experiment
from spark_data.paths import CLEAN_DIR, INCOMING_DIR, REFERENCE_DIR
from spark_data.reference import in_zone, load_reference
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


def _table_status(psi_id: str, expected_table: str, read: set[str]) -> str:
    if expected_table == "none":
        return "none_expected"
    files = {a.file for a in ADAPTERS.values() if a.experiment == psi_id}
    found = len(files & read)
    if found == 0:
        return "not_loaded"
    return "loaded" if found == len(files) else "partial"


def _table_report(table: TableResult) -> dict:
    return {
        "file": table.file,
        "experiment": table.experiment,
        "basis": table.basis,
        "rows_read": table.rows_read,
        "blank_rows": table.blank_rows,
        "points": len(table.points),
        "excluded": sum(table.excluded_reasons.values()),
        "excluded_reasons": dict(table.excluded_reasons),
        "excluded_rows": [row._asdict() for row in table.excluded],
        "duplicates": [row._asdict() for row in table.duplicates],
        "null_fields": [
            {"field": name, "reason": reason, "count": count}
            for (name, reason), count in table.null_fields.items()
        ],
    }


def build_all(incoming: Path, reference: Path, clean: Path) -> dict:
    ref = load_reference(reference)
    build = build_points(incoming, clean)
    issues = list(build.issues)
    registered = {e.psi_id for e in ref.registry.experiments}
    for psi_id in sorted(set(build.experiments) - registered, key=lambda i: int(i[4:])):
        message = "the registry does not list this experiment"
        issues.append(Issue("warning", f"{psi_id.lower()}.json", psi_id, "not_in_registry", message))
    failed = {i.record for i in issues if i.severity == "error"}
    read = {t.file for t in build.tables}
    points = {basis: Counter() for basis in ("ambient", "burner")}
    for table in build.tables:
        points[table.basis][table.experiment] += len(table.points)

    experiments, summaries = [], []
    for entry in ref.registry.experiments:
        record = build.experiments.get(entry.psi_id)
        status = "loaded" if record else "failed_validation" if entry.psi_id in failed else "not_loaded"
        test_table = _table_status(entry.psi_id, entry.test_table, read)
        experiments.append(
            {
                "psi_id": entry.psi_id,
                "kind": entry.kind,
                "status": status,
                "test_table": test_table,
                "reports": [r.model_dump() for r in entry.reports],
                "record": record.model_dump(exclude={"ambient_temperature_K"}) if record else None,
            }
        )
        summaries.append(
            {
                "psi_id": entry.psi_id,
                "kind": entry.kind,
                "status": status,
                "test_table": test_table,
                "ambient_points": points["ambient"][entry.psi_id],
                "burner_points": points["burner"][entry.psi_id],
            }
        )

    lunar = next(h for h in ref.habitats if h.id == "lunar")
    inside = Counter(
        p.experiment_id
        for t in build.tables
        if t.basis == "ambient"
        for p in t.points
        if in_zone(p.o2_pct_min, p.pressure_psi_max, lunar)
    )
    report = {
        "summary": {
            "experiments_loaded": sum(s["status"] == "loaded" for s in summaries),
            "ambient_points": sum(points["ambient"].values()),
            "burner_points": sum(points["burner"].values()),
        },
        "experiments": summaries,
        "tables": [_table_report(t) for t in build.tables],
        "skipped_tables": build.skipped,
        "tables_without_adapter": build.unmatched,
        "validation_issues": [i._asdict() for i in issues],
        "lunar_zone": {
            "definition": {"o2_pct_min": lunar.o2_pct_min, "pressure_psi_max": lunar.pressure_psi_max},
            "test_points": sum(inside.values()),
            "by_experiment": dict(inside),
            "report_conditions": [
                {"experiment_id": c.experiment_id, "test_id": c.test_id}
                for c in ref.report_conditions
                if in_zone(c.o2_pct_min, c.pressure_psi_max, lunar)
            ],
        },
        "outside_psi": [o.model_dump() for o in ref.registry.outside_psi],
        "open_questions": [q.model_dump() for q in ref.registry.open_questions],
    }
    _write_json(clean / "experiments.json", experiments)
    _write_json(clean / "build_report.json", report)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the clean files. Changes nothing in incoming.")
    parser.add_argument("incoming", nargs="?", type=Path, default=INCOMING_DIR)
    parser.add_argument("clean", nargs="?", type=Path, default=CLEAN_DIR)
    args = parser.parse_args(argv)
    report = build_all(args.incoming, REFERENCE_DIR, args.clean)
    for issue in report["validation_issues"]:
        print(format_issue(Issue(**issue)))
    for table in report["tables"]:
        print(
            f"{table['experiment']} {table['file']}: {table['points']} points, {table['excluded']} excluded, "
            f"{len(table['duplicates'])} duplicates, {table['blank_rows']} blank"
        )
    for file, reason in report["skipped_tables"].items():
        print(f"SKIPPED {file}: {reason}")
    for file in report["tables_without_adapter"]:
        print(f"NO ADAPTER {file}")
    for e in report["experiments"]:
        print(
            f"{e['psi_id']}: {e['status']}, table {e['test_table']}, "
            f"{e['ambient_points']} ambient, {e['burner_points']} burner"
        )
    summary, zone = report["summary"], report["lunar_zone"]
    print(f"{summary['ambient_points']} ambient points, {summary['burner_points']} burner points")
    print(f"{zone['test_points']} test points and {len(zone['report_conditions'])} report condition in the lunar zone")
    failed = any(i["severity"] == "error" for i in report["validation_issues"]) or bool(report["skipped_tables"])
    return 1 if failed else 0
