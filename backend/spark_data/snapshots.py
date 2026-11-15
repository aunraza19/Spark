import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import TYPE_CHECKING

from spark_data.models import Habitat
from spark_data.ranking import Condition, Gap, at_target, gap, nearest
from spark_data.reference import in_zone

if TYPE_CHECKING:
    from spark_data.data import Data

SCHEMA = "spark.snapshot.v1"


def data_version(clean: Path, reference: Path) -> str:
    digest = hashlib.sha256()
    for folder in (clean, reference):
        for path in sorted(folder.glob("*.json")):
            digest.update(path.name.encode("utf-8"))
            # Line endings differ between checkouts; the version must not.
            digest.update(path.read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()[:12]


def round_numbers(value, digits: int = 3):
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        return round(value, digits)
    if isinstance(value, dict):
        return {k: round_numbers(v, digits) for k, v in value.items()}
    if isinstance(value, list):
        return [round_numbers(v, digits) for v in value]
    return value


def snapshot_key(snapshot: dict) -> str:
    text = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _habitat(habitat: Habitat) -> dict:
    if habitat.kind == "zone":
        return {
            "id": habitat.id, "kind": habitat.kind, "o2_pct_min": habitat.o2_pct_min,
            "pressure_psi_max": habitat.pressure_psi_max, "source": habitat.source,
        }
    return {
        "id": habitat.id, "kind": habitat.kind, "o2_pct": habitat.o2_pct,
        "pressure_psi": habitat.pressure_psi, "source": habitat.source,
    }


def _nearest_value(condition: Condition, target: Habitat) -> tuple[float, float]:
    """The oxygen and pressure within the condition's range that lie nearest the target."""
    if target.kind == "zone":
        return condition.o2_max, condition.psi_min
    return (
        min(max(target.o2_pct, condition.o2_min), condition.o2_max),
        min(max(target.pressure_psi, condition.psi_min), condition.psi_max),
    )


def _entry(condition: Condition, found: Gap, target: Habitat) -> dict:
    o2, psi = _nearest_value(condition, target)
    return {
        "experiment_id": condition.experiment_id,
        "test_id": condition.test_id,
        "basis": condition.basis,
        "o2_pct": o2,
        "pressure_psi": psi,
        "gap_o2_pct_points": found.o2_pct_points,
        "gap_psi": found.psi,
        "distance": found.distance,
        "source_file": condition.source_file,
        "source_row": condition.source_row,
    }


def _closest_per_experiment(items: list[Condition], target: Habitat, count: int) -> list[dict]:
    best: dict[str, tuple[Condition, Gap]] = {}
    for condition, found in nearest(items, target, len(items)):
        best.setdefault(condition.experiment_id, (condition, found))
    ordered = sorted(best.values(), key=lambda pair: pair[1].distance)[:count]
    return [_entry(condition, found, target) for condition, found in ordered]


def build_map_snapshot(data: "Data", habitat: Habitat, shown_psi_max: float | None = None) -> dict:
    view: dict = {
        "ambient_points_shown": len(data.points),
        "burner_points_hidden": data.burner_count,
        "report_conditions_shown": len(data.report_conditions),
    }
    if habitat.kind == "zone":
        inside = [c for c in data.conditions if in_zone(c.o2_min, c.psi_max, habitat)]
        tests_inside = [c for c in inside if c.basis == "test"]
        view["inside_zone"] = {
            "test_points": len(tests_inside),
            "by_experiment": dict(Counter(c.experiment_id for c in tests_inside)),
            "report_conditions": [
                {"experiment_id": c.experiment_id, "test_id": c.test_id} for c in inside if c.basis == "report"
            ],
        }
        outside = [c for c in data.conditions if not in_zone(c.o2_min, c.psi_max, habitat)]
        view["nearest_outside_zone"] = _closest_per_experiment(outside, habitat, 3)
    else:
        view["nearest_tests_by_experiment"] = _closest_per_experiment(data.conditions, habitat, 3)
    if shown_psi_max is not None:
        view["pressure_range_shown"] = [0, shown_psi_max]
        view["points_not_shown"] = sum(p["pressure_psi_max"] > shown_psi_max for p in data.points)
        view["report_conditions_not_shown"] = sum(c.pressure_psi_max > shown_psi_max for c in data.report_conditions)
    with_conditions = {c.experiment_id for c in data.conditions}
    view["experiments_without_conditions"] = sorted(
        (i for i in data.entries if i not in with_conditions), key=lambda i: int(i[4:])
    )
    snapshot = {
        "schema": SCHEMA,
        "data_version": data.data_version,
        "panel": "map",
        "habitat": _habitat(habitat),
        "view": view,
    }
    return round_numbers(snapshot)


def build_scenario_snapshot(data: "Data", habitat: Habitat) -> dict:
    if habitat.kind != "point":
        raise ValueError("a scenario needs a point target")
    lunar = next(h for h in data.habitats if h.id == "lunar")
    closest = nearest(data.conditions, habitat, 5)
    snapshot = {
        "schema": SCHEMA,
        "data_version": data.data_version,
        "panel": "scenario",
        "habitat": _habitat(habitat),
        "view": {
            "distance_rule": data.ranking.rules.distance_rule,
            "tests_at_target": sum(at_target(gap(c, habitat)) for c in data.conditions),
            "nearest_tests": [_entry(c, g, habitat) for c, g in closest],
            "inside_lunar_zone": in_zone(habitat.o2_pct, habitat.pressure_psi, lunar),
        },
    }
    return round_numbers(snapshot)
