import json
import math
import re

from spark_data.data import Data
from spark_data.models import Habitat
from spark_data.pages import _category_label, experiment_page, ranking_view
from spark_data.plain import _label
from spark_data.snapshots import (
    SCHEMA,
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
        psi_id: {"title": _label(data, psi_id), "fuel_type": _category_label(data, psi_id)}
        for psi_id in sorted(ids, key=lambda i: int(i[4:]))
        if psi_id in data.entries
    }


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
        snapshot = build_map_snapshot(data, resolve_target(data, _text(spec, "habitat"), spec.get("o2"), spec.get("psi")), _shown(spec))
    elif kind == "scenario":
        snapshot = build_scenario_snapshot(data, resolve_target(data, "custom", spec.get("o2"), spec.get("psi")))
    elif kind == "ranking":
        snapshot = build_ranking_snapshot(data, resolve_target(data, _text(spec, "habitat"), spec.get("o2"), spec.get("psi")))
    elif kind == "experiment":
        snapshot = build_experiment_snapshot(data, _text(spec, "experiment_id"))
        if snapshot is None:
            raise BadBlock(404, "unknown experiment")
    else:
        raise BadBlock(422, "kind must be map, scenario, ranking or experiment")
    return snapshot, names_for(data, snapshot)
