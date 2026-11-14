from dataclasses import dataclass
from pathlib import Path

from pydantic import TypeAdapter

from spark_data.models import Habitat, Registry, ReportCondition

_HABITATS = TypeAdapter(list[Habitat])
_CONDITIONS = TypeAdapter(list[ReportCondition])


@dataclass
class Reference:
    habitats: list[Habitat]
    registry: Registry
    report_conditions: list[ReportCondition]


def load_reference(directory: Path) -> Reference:
    def read(name: str) -> str:
        return (directory / name).read_text(encoding="utf-8")

    return Reference(
        _HABITATS.validate_json(read("habitats.json")),
        Registry.model_validate_json(read("registry.json")),
        _CONDITIONS.validate_json(read("report_conditions.json")),
    )


def in_zone(o2_pct_min: float, pressure_psi_max: float, zone: Habitat) -> bool:
    return o2_pct_min >= zone.o2_pct_min and pressure_psi_max <= zone.pressure_psi_max
