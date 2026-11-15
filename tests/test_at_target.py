import dataclasses
from pathlib import Path

import pytest
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.plain import map_summary
from spark_data.ranking import Condition, Gap, at_target, gap
from spark_data.snapshots import build_scenario_snapshot

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


def custom(o2, psi):
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")


@pytest.mark.parametrize(
    "o2, psi, expected",
    [(0.0, 0.0, True), (0.004, -0.004, True), (-0.0049, 0.0049, True), (0.005, 0.0, False), (0.0, -0.006, False), (1.0, 0.0, False)],
)
def test_a_test_is_at_the_target_when_both_gaps_are_zero_to_two_decimals(o2, psi, expected):
    assert at_target(Gap(o2, psi, 0.0)) is expected


def test_the_iss_lines_never_say_zero_psi_or_zero_points(data):
    iss = next(h for h in data.habitats if h.id == "iss")
    lines = map_summary(data, iss)["lead"] + map_summary(data, iss)["dont_know"]
    for line in lines:
        assert " 0 psi" not in line and " 0 point" not in line, line


@pytest.mark.parametrize("target", [(21.0, 14.7), (28.0, 9.0), (34.0, 8.2)])
def test_the_summary_and_the_scenario_agree_on_how_many_tests_are_at_the_target(data, target):
    habitat = custom(*target)
    at = build_scenario_snapshot(data, habitat)["view"]["tests_at_target"]
    tests = sum(c.basis == "test" and at_target(gap(c, habitat)) for c in data.conditions)
    reports = sum(c.basis == "report" and at_target(gap(c, habitat)) for c in data.conditions)
    assert at == tests + reports
    first = map_summary(data, habitat)["lead"][0]
    if tests:
        expected = f"{tests} test{'s' if tests != 1 else ''} ran at exactly this condition."
    elif reports:
        expected = f"{reports} condition{'s' if reports != 1 else ''} from a NASA report {'match' if reports != 1 else 'matches'} this target exactly."
    else:
        expected = "No test ran at exactly this condition."
    assert first == expected


def test_a_gap_that_rounds_to_nothing_is_written_as_under_0_01(data):
    lunar = next(h for h in data.habitats if h.id == "lunar")
    just_over = Condition("PSI-69", "x", "test", 35, 35, 10.204, 10.204, "f.csv", 2, "liquid")
    synthetic = dataclasses.replace(data, conditions=[just_over])
    dont = map_summary(synthetic, lunar)["dont_know"]
    assert "The closest was PSI-69: under 0.01 psi too much pressure." in dont
