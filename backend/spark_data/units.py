# SI definitions: 1 atm = 101325 Pa, 1 bar = 100000 Pa, 1 mmHg = 1 atm / 760.
PA_PER_ATM = 101325.0
PA_PER_BAR = 100000.0
PA_PER_MMHG = PA_PER_ATM / 760
PA_PER_PSI = 6894.757293168


def atm_to_psi(atm: float) -> float:
    return atm * PA_PER_ATM / PA_PER_PSI


def bar_to_psi(bar: float) -> float:
    return bar * PA_PER_BAR / PA_PER_PSI


def mmhg_to_psi(mmhg: float) -> float:
    return mmhg * PA_PER_MMHG / PA_PER_PSI


def fraction_to_percent(fraction: float) -> float:
    return fraction * 100
