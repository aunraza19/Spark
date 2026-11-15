import math
from dataclasses import dataclass
from pathlib import Path
from typing import NamedTuple

from pydantic import TypeAdapter

from spark_data.models import FuelCategory, Habitat, RankingRules, ReportCondition
from spark_data.reference import in_zone

_FUEL_CATEGORIES = TypeAdapter(list[FuelCategory])


@dataclass(frozen=True)
class Condition:
    experiment_id: str
    test_id: str | None
    basis: str
    o2_min: float
    o2_max: float
    psi_min: float
    psi_max: float
    source_file: str
    source_row: int | None


class Gap(NamedTuple):
    o2_pct_points: float
    psi: float
    distance: float


@dataclass(frozen=True)
class RankRow:
    psi_id: str
    kind: str
    category: str
    atmosphere_match: float
    tests_inside_zone: int | None
    tests_with_conditions: int
    material_relevance: int


@dataclass(frozen=True)
class NotScored:
    psi_id: str
    kind: str
    category: str
    material_relevance: int
    reason: str


@dataclass(frozen=True)
class Ranking:
    rows: list[RankRow]
    not_scored: list[NotScored]


@dataclass(frozen=True)
class RankingData:
    rules: RankingRules
    fuel_categories: list[FuelCategory]


def load_ranking(directory: Path) -> RankingData:
    return RankingData(
        RankingRules.model_validate_json((directory / "ranking_rules.json").read_text(encoding="utf-8")),
        _FUEL_CATEGORIES.validate_json((directory / "fuel_categories.json").read_text(encoding="utf-8")),
    )


def conditions(points: list[dict], report_conditions: list[ReportCondition]) -> list[Condition]:
    found = [
        Condition(
            p["experiment_id"], p["test_id"], "test", p["o2_pct_min"], p["o2_pct_max"],
            p["pressure_psi_min"], p["pressure_psi_max"], p["source_file"], p["source_row"],
        )
        for p in points
    ]
    found += [
        Condition(
            c.experiment_id, c.test_id, "report", c.o2_pct_min, c.o2_pct_max,
            c.pressure_psi_min, c.pressure_psi_max, c.source.file, None,
        )
        for c in report_conditions
    ]
    return found


def gap(condition: Condition, target: Habitat) -> Gap:
    if target.kind == "zone":
        o2 = max(0.0, target.o2_pct_min - condition.o2_max)
        psi = max(0.0, condition.psi_min - target.pressure_psi_max)
        return Gap(o2, psi, math.hypot(o2 / target.o2_pct_min, psi / target.pressure_psi_max))
    o2 = min(max(target.o2_pct, condition.o2_min), condition.o2_max) - target.o2_pct
    psi = min(max(target.pressure_psi, condition.psi_min), condition.psi_max) - target.pressure_psi
    return Gap(o2, psi, math.hypot(o2 / target.o2_pct, psi / target.pressure_psi))


def atmosphere_match(distance: float) -> float:
    return 100 * (1 - min(1.0, distance))


def nearest(items: list[Condition], target: Habitat, count: int) -> list[tuple[Condition, Gap]]:
    return sorted(((c, gap(c, target)) for c in items), key=lambda pair: pair[1].distance)[:count]


def _number(psi_id: str) -> int:
    return int(psi_id[4:])


def rank(entries: list[dict], items: list[Condition], target: Habitat, data: RankingData) -> Ranking:
    categories = {f.psi_id: f.category for f in data.fuel_categories}
    rows: list[RankRow] = []
    not_scored: list[NotScored] = []
    for entry in entries:
        psi_id = entry["psi_id"]
        category = categories[psi_id]
        material = data.rules.categories[category].weight
        own = [c for c in items if c.experiment_id == psi_id]
        if not own:
            reason = (
                "ground study: no test table of its own"
                if entry["kind"] == "ground"
                else "no per-test conditions in the tables loaded"
            )
            not_scored.append(NotScored(psi_id, entry["kind"], category, material, reason))
            continue
        nearest_distance = min(gap(c, target).distance for c in own)
        inside = sum(in_zone(c.o2_min, c.psi_max, target) for c in own) if target.kind == "zone" else None
        rows.append(
            RankRow(psi_id, entry["kind"], category, atmosphere_match(nearest_distance), inside, len(own), material)
        )
    rows.sort(key=lambda r: (-r.atmosphere_match, -r.material_relevance, _number(r.psi_id)))
    not_scored.sort(key=lambda n: (-n.material_relevance, _number(n.psi_id)))
    return Ranking(rows, not_scored)
