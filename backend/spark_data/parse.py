import math
import re
from typing import NamedTuple

from spark_data.units import atm_to_psi, bar_to_psi, fraction_to_percent, mmhg_to_psi

_TO_PSI = {"atm": atm_to_psi, "bar": bar_to_psi, "mmHg": mmhg_to_psi}
_O2_TEXT = re.compile(r"\s*(~)?\s*([\d.]+)\s*(?:(?:-|to)\s*([\d.]+))?\s*")


class Reading(NamedTuple):
    value: float | None
    reason: str | None


class O2Range(NamedTuple):
    minimum: float | None
    maximum: float | None
    approximate: bool
    reason: str | None


def parse_number(cell: str) -> Reading:
    text = cell.strip()
    if not text:
        return Reading(None, "empty cell")
    try:
        value = float(text)
    except ValueError:
        return Reading(None, f"not a number: {text!r}")
    if not math.isfinite(value):
        return Reading(None, f"not a number: {text!r}")
    return Reading(value, None)


def _checked_o2(percent: float) -> Reading:
    if 0 <= percent <= 100:
        return Reading(percent, None)
    return Reading(None, f"oxygen {percent:g} % is outside 0 to 100 %")


def o2_from_fraction(cell: str) -> Reading:
    number = parse_number(cell)
    if number.value is None:
        return number
    return _checked_o2(fraction_to_percent(number.value))


def o2_from_percent(cell: str) -> Reading:
    number = parse_number(cell.strip().removesuffix("%"))
    if number.value is None:
        return number
    return _checked_o2(number.value)


def o2_from_text(cell: str) -> O2Range:
    match = _O2_TEXT.fullmatch(cell)
    if match is None:
        return O2Range(None, None, False, f"not an oxygen value: {cell.strip()!r}")
    readings = [o2_from_percent(group) for group in match.groups()[1:] if group]
    for reading in readings:
        if reading.value is None:
            return O2Range(None, None, False, reading.reason)
    values = [reading.value for reading in readings]
    return O2Range(min(values), max(values), match[1] is not None, None)


def pressure_to_psi(cell: str, unit: str) -> Reading:
    number = parse_number(cell.strip().removesuffix(unit))
    if number.value is None:
        return number
    if number.value <= 0:
        return Reading(None, f"pressure {number.value:g} {unit} is zero or below")
    return Reading(_TO_PSI[unit](number.value), None)
