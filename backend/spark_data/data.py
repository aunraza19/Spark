import json
from dataclasses import dataclass
from pathlib import Path

from spark_data.models import Habitat, ReportCondition
from spark_data.ranking import Condition, RankingData, conditions, load_ranking
from spark_data.reference import load_reference
from spark_data.snapshots import data_version


@dataclass(frozen=True)
class Data:
    entries: dict[str, dict]
    points: list[dict]
    burner_count: int
    report_conditions: list[ReportCondition]
    habitats: list[Habitat]
    ranking: RankingData
    conditions: list[Condition]
    data_version: str


def _read(directory: Path, name: str):
    return json.loads((directory / name).read_text(encoding="utf-8"))


def load_data(clean: Path, reference: Path) -> Data:
    ref = load_reference(reference)
    points = _read(clean, "test_points.json")
    return Data(
        entries={e["psi_id"]: e for e in _read(clean, "experiments.json")},
        points=points,
        burner_count=len(_read(clean, "burner_points.json")),
        report_conditions=ref.report_conditions,
        habitats=ref.habitats,
        ranking=load_ranking(reference),
        conditions=conditions(points, ref.report_conditions),
        data_version=data_version(clean, reference),
    )
