import pytest
from pytest import approx
from spark_data.parse import (
    o2_from_fraction,
    o2_from_percent,
    o2_from_text,
    parse_number,
    pressure_to_psi,
)

ONE_ATM_PSI = 101325 / 6894.757293168
ONE_BAR_PSI = 100000 / 6894.757293168
# PSI-69 row 25 holds byte 0x96 (an en dash in cp1252) in the burning-rate cell.
PSI69_DASH_CELL = b"\x96".decode("cp1252")


def test_parse_number_reads_a_number():
    # PSI-69 first row, pressure cell.
    assert parse_number("757.7").value == approx(757.7)
    assert parse_number("757.7").reason is None


@pytest.mark.parametrize(
    "cell",
    ["RAMP", "RAMPED", "LOW O2", PSI69_DASH_CELL, "21; 26.5; 40", "nan", "inf"],
)
def test_parse_number_non_numeric_cell_is_null_with_reason(cell):
    reading = parse_number(cell)
    assert reading.value is None
    assert repr(cell.strip()) in reading.reason


@pytest.mark.parametrize("cell", ["", "   "])
def test_parse_number_empty_cell_is_null_with_reason(cell):
    # PSI-10 normal, 'XO2 (final)' is empty in 20 rows.
    reading = parse_number(cell)
    assert reading.value is None
    assert "empty" in reading.reason


def test_o2_from_fraction_converts_to_percent():
    # PSI-39 cell "0.17", PSI-159 cell "0.3997".
    assert o2_from_fraction("0.17").value == approx(17.0)
    assert o2_from_fraction("0.3997").value == approx(39.97)


def test_o2_from_fraction_accepts_both_ends_of_the_range():
    assert o2_from_fraction("0").value == approx(0.0)
    assert o2_from_fraction("1").value == approx(100.0)


@pytest.mark.parametrize("cell", ["1.2", "-0.1", "34"])
def test_o2_from_fraction_outside_0_to_100_percent_is_rejected(cell):
    reading = o2_from_fraction(cell)
    assert reading.value is None
    assert "outside 0 to 100" in reading.reason


def test_o2_from_fraction_non_numeric_cell_is_null_with_reason():
    reading = o2_from_fraction("RAMP")
    assert reading.value is None
    assert "RAMP" in reading.reason


def test_o2_from_percent_keeps_the_percent():
    # PSI-25 cell "22.2".
    assert o2_from_percent("22.2").value == approx(22.2)


def test_o2_from_percent_accepts_a_percent_sign_and_both_ends():
    assert o2_from_percent("21%").value == approx(21.0)
    assert o2_from_percent("0").value == approx(0.0)
    assert o2_from_percent("100").value == approx(100.0)


@pytest.mark.parametrize("cell", ["3400%", "2100%", "100.5", "-1"])
def test_o2_from_percent_outside_0_to_100_is_rejected(cell):
    # PSI-20 table cells "3400%" and "2100%".
    reading = o2_from_percent(cell)
    assert reading.value is None
    assert "outside 0 to 100" in reading.reason


def test_o2_from_percent_list_cell_is_null_with_reason():
    # PSI-20 table cell "21; 26.5; 40" lists several levels for one day.
    reading = o2_from_percent("21; 26.5; 40")
    assert reading.value is None
    assert reading.reason is not None


def test_o2_from_text_single_value():
    result = o2_from_text("21.5")
    assert (result.minimum, result.maximum) == approx((21.5, 21.5))
    assert result.approximate is False
    assert result.reason is None


def test_o2_from_text_dash_range():
    # PSI-98 cell "21.5 - 21.7".
    result = o2_from_text("21.5 - 21.7")
    assert (result.minimum, result.maximum) == approx((21.5, 21.7))
    assert result.approximate is False


def test_o2_from_text_tilde_is_approximate():
    # PSI-98 cell "~ 21.5", PSI-99 cell "~ 22.1".
    result = o2_from_text("~ 22.1")
    assert (result.minimum, result.maximum) == approx((22.1, 22.1))
    assert result.approximate is True


def test_o2_from_text_to_range_is_ordered_low_to_high():
    # PSI-99 cells "22.1 to 22.0" and "22.0 to 21.9".
    first = o2_from_text("22.1 to 22.0")
    assert (first.minimum, first.maximum) == approx((22.0, 22.1))
    second = o2_from_text("22.0 to 21.9")
    assert (second.minimum, second.maximum) == approx((21.9, 22.0))


@pytest.mark.parametrize("cell", ["", "n/a", "3400 - 3500", "21.5 - abc"])
def test_o2_from_text_bad_cell_is_null_with_reason(cell):
    result = o2_from_text(cell)
    assert result.minimum is None
    assert result.maximum is None
    assert result.reason is not None


def test_pressure_mmhg_cell_to_psi():
    # PSI-69 first row, 757.7 mmHg.
    assert pressure_to_psi("757.7", "mmHg").value == approx(757.7 / 760 * ONE_ATM_PSI)


@pytest.mark.parametrize("cell, atm", [("1 atm ", 1), ("0.75 atm", 0.75), ("5 atm ", 5)])
def test_pressure_text_atm_cell_to_psi(cell, atm):
    # PSI-39 cells, unit written in the cell, with trailing spaces.
    assert pressure_to_psi(cell, "atm").value == approx(atm * ONE_ATM_PSI)


def test_pressure_bar_cell_to_psi():
    # PSI-159 normal cell "0.50665".
    assert pressure_to_psi("0.50665", "bar").value == approx(0.50665 * ONE_BAR_PSI)


@pytest.mark.parametrize("cell", ["0", "-1"])
def test_pressure_zero_or_below_is_rejected(cell):
    # PSI-69 test 114 has pressure "0".
    reading = pressure_to_psi(cell, "mmHg")
    assert reading.value is None
    assert "zero or below" in reading.reason


@pytest.mark.parametrize("cell", ["", "RAMP", PSI69_DASH_CELL])
def test_pressure_non_numeric_cell_is_null_with_reason(cell):
    reading = pressure_to_psi(cell, "atm")
    assert reading.value is None
    assert reading.reason is not None
