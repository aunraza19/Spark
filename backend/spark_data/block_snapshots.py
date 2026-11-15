import json
import math
import re
from collections import Counter

from spark_data.data import Data
from spark_data.models import Habitat
from spark_data.pages import _category, _category_label, experiment_page, ranking_view
from spark_data.plain import _burned, _label, _point_for, _report_for, _result
from spark_data.ranking import Condition, gap, nearest
from spark_data.reference import in_zone
from spark_data.snapshots import (
    SCHEMA,
    _entry,
    _habitat,
    build_map_snapshot,
    build_scenario_snapshot,
    round_numbers,
)


class BadBlock(ValueError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def resolve_target(data: Data, habitat: str | None, o2: float | None, psi: float | None) -> Habitat:
    if habitat == "custom":
        valid = _is_number(o2) and _is_number(psi) and 0 < o2 <= 100 and 0 < psi and math.isfinite(psi)
        if not valid:
            raise BadBlock(422, "custom needs oxygen above 0 and up to 100 %, and pressure above 0 psi")
        return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")
    target = next((h for h in data.habitats if h.id == habitat and h.kind != "note"), None)
    if target is None:
        raise BadBlock(404, "unknown habitat")
    return target


def build_ranking_snapshot(data: Data, target: Habitat) -> dict:
    view = ranking_view(data, target)
    return round_numbers(
        {
            "schema": SCHEMA,
            "data_version": data.data_version,
            "panel": "ranking",
            "habitat": _habitat(target),
            "lead": view["lead"],
            "rows": view["rows"],
            "not_scored": view["not_scored"],
            "evidence": view["evidence"],
        }
    )


def build_experiment_snapshot(data: Data, psi_id: str) -> dict | None:
    page = experiment_page(data, psi_id)
    if page is None:
        return None
    record = data.entries[psi_id]["record"]
    conditions = page["evidence"]["conditions"]
    return round_numbers(
        {
            "schema": SCHEMA,
            "data_version": data.data_version,
            "panel": "experiment",
            "experiment": {
                "psi_id": psi_id,
                "title": page["title"],
                "name": page["name"],
                "kind": page["kind"],
                "lead": page["lead"],
                "key_results": page["key_results"],
                "conditions": {
                    "tests_on_map": conditions["tests_on_map"],
                    "report_conditions_on_map": conditions["report_conditions_on_map"],
                    "ranges": conditions["ranges"],
                    "source_files": conditions["source_files"],
                    "record_note": conditions["record_note"],
                },
                "fuels": record["fuel"],
                "sensors": record["sensors"],
                "data_quality_notes": record["data_quality_notes"],
                "publication_count": len(record["publications"]),
            },
        }
    )


def names_for(data: Data, snapshot: dict) -> dict:
    ids = set(re.findall(r"PSI-\d+", json.dumps(snapshot, ensure_ascii=False)))
    return {
        psi_id: {
            "title": _label(data, psi_id),
            "fuel_type": _category_label(data, psi_id),
            "burned": data.plain.categories[_category(data, psi_id)].words,
        }
        for psi_id in sorted(ids, key=lambda i: int(i[4:]))
        if psi_id in data.entries
    }


def _find(data: Data, **keys) -> Condition:
    return next(c for c in data.conditions if all(getattr(c, name) == value for name, value in keys.items()))


def _what_happened(data: Data, condition: Condition, target: Habitat) -> dict:
    """What one test or report condition was, how far it is from the target, what it burned and what happened."""
    entry = _entry(condition, gap(condition, target), target)
    if condition.basis == "report":
        report = _report_for(data, condition)
        burned, result = report.fuel, report.outcome_words
        source = f"{report.source.file}, page {report.source.page}, {report.source.figure}"
    else:
        point = _point_for(data, condition)
        burned = _burned(data, point["fuel_state"], point["fuel"])
        result = _result(data, point["experiment_id"], point["outcome"])
        source = f"{condition.source_file}, row {condition.source_row}"
    keys = ("experiment_id", "test_id", "basis", "o2_pct", "pressure_psi", "gap_o2_pct_points", "gap_psi")
    return {**{k: entry[k] for k in keys}, "burned": burned, "result": result, "source": source}


def _inside_zone(data: Data, zone: Habitat) -> list[dict]:
    results: dict[str, Counter] = {}
    for c in data.conditions:
        if c.basis == "test" and in_zone(c.o2_min, c.psi_max, zone):
            point = _point_for(data, c)
            results.setdefault(c.experiment_id, Counter())[_result(data, c.experiment_id, point["outcome"])] += 1
    return [
        {
            "experiment_id": psi_id,
            "burned": data.plain.categories[_category(data, psi_id)].words,
            "tests": sum(counted.values()),
            "results": [{"result": words, "tests": n} for words, n in counted.most_common()],
        }
        for psi_id, counted in sorted(results.items(), key=lambda item: int(item[0][4:]))
    ]


def _with_outcomes(data: Data, snapshot: dict, target: Habitat) -> dict:
    """The agent also needs to know what happened in the tests the block points at, so the answer can say it."""
    panel, view = snapshot["panel"], snapshot.get("view", {})
    outcomes: dict = {}
    if panel == "map" and target.kind == "zone":
        outcomes["inside_zone"] = _inside_zone(data, target)
        listed = [_find(data, experiment_id=r["experiment_id"], test_id=r["test_id"], basis="report") for r in view["inside_zone"]["report_conditions"]]
        listed += [
            _find(data, experiment_id=e["experiment_id"], test_id=e["test_id"], basis=e["basis"], source_file=e["source_file"], source_row=e["source_row"])
            for e in view["nearest_outside_zone"]
        ]
    elif panel in ("map", "scenario"):
        entries = view["nearest_tests_by_experiment"] if panel == "map" else view["nearest_tests"]
        listed = [
            _find(data, experiment_id=e["experiment_id"], test_id=e["test_id"], basis=e["basis"], source_file=e["source_file"], source_row=e["source_row"])
            for e in entries
        ]
    else:
        listed = [nearest([c for c in data.conditions if c.experiment_id == row["psi_id"]], target, 1)[0][0] for row in snapshot["rows"][:3]]
    outcomes["conditions"] = [_what_happened(data, c, target) for c in listed]
    return round_numbers({**snapshot, "outcomes": outcomes})


def _text(spec: dict, name: str) -> str:
    value = spec.get(name)
    if not isinstance(value, str) or not value:
        raise BadBlock(422, f"{name} is needed")
    return value


def _shown(spec: dict) -> float | None:
    shown = spec.get("shown_psi_max")
    if shown is None:
        return None
    if not (_is_number(shown) and shown > 0 and math.isfinite(shown)):
        raise BadBlock(422, "shown_psi_max must be above 0 psi")
    return shown


def snapshot_for(data: Data, spec: dict) -> tuple[dict, dict]:
    """The snapshot and the names behind one block of the page. Built here, never taken from the page."""
    kind = spec.get("kind") if isinstance(spec, dict) else None
    if kind == "map":
        target = resolve_target(data, _text(spec, "habitat"), spec.get("o2"), spec.get("psi"))
        snapshot = _with_outcomes(data, build_map_snapshot(data, target, _shown(spec)), target)
    elif kind == "scenario":
        target = resolve_target(data, "custom", spec.get("o2"), spec.get("psi"))
        snapshot = _with_outcomes(data, build_scenario_snapshot(data, target), target)
    elif kind == "ranking":
        target = resolve_target(data, _text(spec, "habitat"), spec.get("o2"), spec.get("psi"))
        snapshot = _with_outcomes(data, build_ranking_snapshot(data, target), target)
    elif kind == "experiment":
        snapshot = build_experiment_snapshot(data, _text(spec, "experiment_id"))
        if snapshot is None:
            raise BadBlock(404, "unknown experiment")
    else:
        raise BadBlock(422, "kind must be map, scenario, ranking or experiment")
    return snapshot, names_for(data, snapshot)
