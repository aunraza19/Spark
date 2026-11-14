from pytest import approx
from spark_data.units import atm_to_psi, bar_to_psi, fraction_to_percent, mmhg_to_psi

# Definitions: 1 atm = 101325 Pa, 1 bar = 100000 Pa, 1 psi = 6894.757293168 Pa.
ONE_ATM_PSI = 101325 / 6894.757293168
ONE_BAR_PSI = 100000 / 6894.757293168


def test_760_mmhg_is_one_atm_in_psi():
    assert mmhg_to_psi(760) == approx(ONE_ATM_PSI, rel=1e-9)


def test_one_atm_in_psi():
    assert atm_to_psi(1) == approx(ONE_ATM_PSI, rel=1e-9)


def test_half_atm_in_psi():
    assert atm_to_psi(0.5) == approx(ONE_ATM_PSI / 2, rel=1e-9)


def test_one_bar_in_psi():
    assert bar_to_psi(1) == approx(ONE_BAR_PSI, rel=1e-9)


def test_psi159_lowest_pressure_cell_in_psi():
    assert bar_to_psi(0.50665) == approx(0.50665 * ONE_BAR_PSI, rel=1e-9)


def test_fraction_to_percent():
    assert fraction_to_percent(0.17) == approx(17.0, rel=1e-9)
    assert fraction_to_percent(0.3997) == approx(39.97, rel=1e-9)


def test_converters_do_not_round():
    # PSI-69 cell "526.3" mmHg is 10.178... psi, not 10.18.
    psi = mmhg_to_psi(526.3)
    assert psi == approx(526.3 / 760 * ONE_ATM_PSI, rel=1e-12)
    assert psi != round(psi, 2)
