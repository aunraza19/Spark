import csv
import io
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, NamedTuple

from pydantic import BaseModel

from spark_data.models import Experiment
from spark_data.parse import (
    o2_from_fraction,
    o2_from_percent,
    o2_from_text,
    parse_number,
    pressure_to_psi,
)


class Point(BaseModel):
    experiment_id: str
    test_id: str | None
    o2_pct_min: float
    o2_pct_max: float
    o2_approximate: bool
    pressure_psi_min: float
    pressure_psi_max: float
    pressure_basis: Literal["table", "record"]
    fuel: str | None
    fuel_state: str | None
    outcome: str | None
    fuel_flow_mg_s: float | None
    source_file: str
    source_row: int


@dataclass(frozen=True)
class Adapter:
    file: str
    experiment: str
    basis: Literal["ambient", "burner"] = "ambient"
    test_id: str | None = None
    o2: str | None = None
    o2_kind: Literal["fraction", "percent", "text"] = "fraction"
    pressure: str | None = None
    pressure_unit: str | None = None
    fuel: str | None = None
    outcome: str | None = None
    fuel_flow: str | None = None
    encoding: str = "utf-8-sig"
    no_points: str | None = None


class Exclusion(NamedTuple):
    row: int
    test_id: str | None
    reason: str


class Duplicate(NamedTuple):
    row: int
    test_id: str | None
    first_row: int


@dataclass
class TableResult:
    file: str
    experiment: str
    basis: str
    rows_read: int = 0
    blank_rows: int = 0
    points: list[Point] = field(default_factory=list)
    excluded: list[Exclusion] = field(default_factory=list)
    excluded_reasons: Counter = field(default_factory=Counter)
    duplicates: list[Duplicate] = field(default_factory=list)
    null_fields: Counter = field(default_factory=Counter)


_NO_O2_OR_PRESSURE = "no oxygen or pressure columns"

ADAPTERS: dict[str, Adapter] = {
    adapter.file: adapter
    for adapter in (
        Adapter(
            "PSI-10_Experimental table_Flame Design_Normal Flame.csv", "PSI-10",
            test_id="Test", o2="XO2 (init)", pressure="pinit (atm)", pressure_unit="atm",
            fuel="Fuel", fuel_flow="mfuel (mg/s)",
        ),
        Adapter(
            "PSI-10_Experimental table_Flame Design_Inverse Flame.csv", "PSI-10", "burner",
            test_id="Test", o2="XO2", pressure="pinit (atm)", pressure_unit="atm",
        ),
        Adapter(
            "PSI-159_Experimental table_CFI-G_Normal Flames.csv", "PSI-159",
            test_id="Test", o2="XO2 before test", pressure="approx p (bar)", pressure_unit="bar",
            fuel="Fuel", outcome="Self-ext or flow term", fuel_flow="mHC (mg/s)",
        ),
        Adapter(
            "PSI-159_Experimental table_CFI-G_Inverse Flames.csv", "PSI-159", "burner",
            test_id="Test", o2="XO2", pressure="approx p (bar)", pressure_unit="bar",
            fuel="Fuel", outcome="Self -ext or flow term", fuel_flow="HC burnrate (mg/s)",
        ),
        Adapter(
            "PSI-39_Experimental table_CFI.csv", "PSI-39",
            test_id="Flex Number", o2="Oxygen", pressure="Pressure", pressure_unit="atm",
            fuel="Fuel",
        ),
        Adapter(
            "PSI-69_Experimental table_FLEX.csv", "PSI-69", encoding="cp1252",
            test_id="FLEX Test #", o2="O initial ambient composition; mole fraction",
            pressure="Ambient pressure; mmHg", pressure_unit="mmHg",
            fuel="Fuel", outcome="Test end",
        ),
        Adapter(
            "PSI-25_Experimental table_BASS-II.csv", "PSI-25",
            test_id="Test #", o2="Calibrated initial O2 % by vol", o2_kind="percent",
            fuel="Fuel Sample Material",
        ),
        Adapter(
            "PSI-98_Experimental table_SAFFIRE-1.csv", "PSI-98",
            test_id="Sample Number", o2="Percent O2", o2_kind="text", fuel="Material",
        ),
        Adapter(
            "PSI-99_Experimental table_SAFFIRE-2.csv", "PSI-99",
            test_id="Sample Number", o2="Percent O2 (Note 1)", o2_kind="text", fuel="Material",
        ),
        Adapter(
            "PSI-20_Experimental table_ACME BRE.csv", "PSI-20",
            no_points="daily summary: oxygen is a list of levels per day and there is no pressure column",
        ),
        Adapter(
            "PSI-21_Experimental table_CLD Flame.csv", "PSI-21",
            no_points=f"daily summary: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-22_Experimental table_ACME E-FIELD Flames.csv", "PSI-22",
            no_points=f"daily summary: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-23_Experimental table_ACME s-Flame.csv", "PSI-23",
            no_points="daily summary: atmosphere is text per day and there is no pressure column",
        ),
        Adapter(
            "PSI-26_Experimental table_BASS.csv", "PSI-26",
            no_points=f"sample list: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-47_Experimental table_DAFT.csv", "PSI-47",
            no_points=f"session list: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-68_Experimental table_Flex2.csv", "PSI-68",
            no_points="planned test matrix: ranges, not per-test values",
        ),
        Adapter(
            "PSI-100_Experimental table_SAFFIRE-3.csv", "PSI-100",
            no_points=f"sample list: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-101_Experimental table_SAME-R.csv", "PSI-101",
            no_points=f"sample list: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-102_Experimental table_SAME.csv", "PSI-102",
            no_points=f"sample list: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-106_Experimental table_Slice.csv", "PSI-106",
            no_points=f"test day list: {_NO_O2_OR_PRESSURE}",
        ),
        Adapter(
            "PSI-107_Experimental table_Spice.csv", "PSI-107",
            no_points=f"flame log: {_NO_O2_OR_PRESSURE}",
        ),
    )
}


def _text(cell: str) -> str | None:
    return cell.strip() or None


def _o2(adapter: Adapter, cell: str) -> tuple[float | None, float | None, bool, str | None]:
    if adapter.o2_kind == "text":
        return tuple(o2_from_text(cell))
    reading = (o2_from_fraction if adapter.o2_kind == "fraction" else o2_from_percent)(cell)
    return reading.value, reading.value, False, reading.reason


def _pressure(adapter: Adapter, cell: str, experiment: Experiment):
    if adapter.pressure is not None:
        reading = pressure_to_psi(cell, adapter.pressure_unit)
        return reading.value, reading.value, reading.reason
    low, high = experiment.pressure_min_psi, experiment.pressure_max_psi
    if low is None or high is None:
        return None, None, "the record gives no pressure range"
    return low, high, None


def read_table(adapter: Adapter, path: Path, experiment: Experiment) -> TableResult:
    result = TableResult(adapter.file, adapter.experiment, adapter.basis)
    reader = csv.reader(io.StringIO(path.read_bytes().decode(adapter.encoding), newline=""))
    column = {" ".join(name.split()): index for index, name in enumerate(next(reader))}
    wanted = (adapter.test_id, adapter.o2, adapter.pressure, adapter.fuel, adapter.outcome, adapter.fuel_flow)
    missing = [name for name in wanted if name is not None and name not in column]
    if missing:
        raise ValueError(f"{adapter.file}: column not found: {', '.join(missing)}")

    def get(cells: list[str], name: str | None) -> str:
        index = column.get(name)
        return cells[index] if index is not None and index < len(cells) else ""

    first_seen: dict[tuple[str, ...], int] = {}
    for cells in reader:
        row = reader.line_num
        if not any(cell.strip() for cell in cells):
            result.blank_rows += 1
            continue
        result.rows_read += 1
        test_id = _text(get(cells, adapter.test_id))
        if tuple(cells) in first_seen:
            result.duplicates.append(Duplicate(row, test_id, first_seen[tuple(cells)]))
            continue
        first_seen[tuple(cells)] = row
        if adapter.no_points is not None:
            result.excluded_reasons[adapter.no_points] += 1
            continue

        o2_min, o2_max, approximate, o2_reason = _o2(adapter, get(cells, adapter.o2))
        p_min, p_max, p_reason = _pressure(adapter, get(cells, adapter.pressure), experiment)
        reason = (o2_reason and f"oxygen: {o2_reason}") or (p_reason and f"pressure: {p_reason}")
        if reason:
            result.excluded.append(Exclusion(row, test_id, reason))
            result.excluded_reasons[reason] += 1
            continue
        flow = parse_number(get(cells, adapter.fuel_flow)) if adapter.fuel_flow else None
        if flow is not None and flow.value is None:
            result.null_fields[("fuel_flow_mg_s", flow.reason)] += 1
        result.points.append(
            Point(
                experiment_id=adapter.experiment,
                test_id=test_id,
                o2_pct_min=o2_min,
                o2_pct_max=o2_max,
                o2_approximate=approximate,
                pressure_psi_min=p_min,
                pressure_psi_max=p_max,
                pressure_basis="table" if adapter.pressure else "record",
                fuel=_text(get(cells, adapter.fuel)),
                fuel_state=experiment.fuel_state,
                outcome=_text(get(cells, adapter.outcome)),
                fuel_flow_mg_s=flow.value if flow else None,
                source_file=adapter.file,
                source_row=row,
            )
        )
    return result
