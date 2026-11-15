import json
import math
from pathlib import Path

import pytest
from pytest import approx
from spark_data.models import Habitat
from spark_data.ranking import (
    Condition,
    atmosphere_match,
    conditions,
    gap,
    load_ranking,
    nearest,
    rank,
)
from spark_data.reference import in_zone, load_reference

REPO = Path(__file__).resolve().parents[1]
CLEAN = REPO / "data" / "clean"
REFERENCE = REPO / "data" / "reference"


@pytest.fixture(scope="module")
def reference():
    return load_reference(REFERENCE)


@pytest.fixture(scope="module")
def lunar(reference):
    return next(h for h in reference.habitats if h.id == "lunar")


@pytest.fixture(scope="module")
def iss(reference):
    return next(h for h in reference.habitats if h.id == "iss")


@pytest.fixture(scope="module")
def custom():
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=28.0, pressure_psi=9.0, source="User input")


@pytest.fixture(scope="module")
def ranking_data():
    return load_ranking(REFERENCE)


@pytest.fixture(scope="module")
def entries():
    return json.loads((CLEAN / "experiments.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def real_conditions(reference):
    points = json.loads((CLEAN / "test_points.json").read_text(encoding="utf-8"))
    return conditions(points, reference.report_conditions)


def cond(o2_min, o2_max, psi_min, psi_max, experiment="PSI-X", test="t"):
    return Condition(experiment, test, "test", o2_min, o2_max, psi_min, psi_max, "f.csv", 2)


# --- the distance rule, hand-computed from its definition ---------------------


def test_a_condition_inside_the_zone_has_distance_zero(lunar):
    assert gap(cond(34, 34, 8.2, 8.2), lunar) == (0.0, 0.0, 0.0)


def test_oxygen_gap_below_the_zone_is_a_share_of_the_zone_oxygen(lunar):
    result = gap(cond(27, 27, 10.2, 10.2), lunar)
    assert (result.o2_pct_points, result.psi) == approx((3.0, 0.0))
    assert result.distance == approx(3 / 30)


def test_pressure_gap_above_the_zone_is_a_share_of_the_zone_pressure(lunar):
    result = gap(cond(34, 34, 10.332, 10.332), lunar)
    assert (result.o2_pct_points, result.psi) == approx((0.0, 0.132))
    assert result.distance == approx(0.132 / 10.2)


def test_both_gaps_combine_as_a_hypotenuse(lunar):
    result = gap(cond(21, 21, 14.7, 14.7), lunar)
    assert result.distance == approx(math.hypot(9 / 30, 4.5 / 10.2))


def test_a_range_uses_its_best_value_for_the_zone(lunar):
    # Oxygen 29 to 31 % at 8 to 12 psi: the best case is 31 % at 8 psi, which is inside.
    assert gap(cond(29, 31, 8, 12), lunar).distance == 0.0


def test_point_target_gaps_are_signed_and_relative(custom):
    result = gap(cond(27, 27, 10.2, 10.2), custom)
    assert (result.o2_pct_points, result.psi) == approx((-1.0, 1.2))
    assert result.distance == approx(math.hypot(1 / 28, 1.2 / 9))


def test_point_target_inside_a_range_has_no_gap_on_that_axis(iss):
    result = gap(cond(20.5, 21.5, 14.7, 14.7), iss)
    assert result.o2_pct_points == 0.0
    assert result.distance == approx(0.0, abs=1e-12)


@pytest.mark.parametrize("distance, score", [(0.0, 100.0), (0.1, 90.0), (0.5, 50.0), (1.0, 0.0), (2.5, 0.0)])
def test_atmosphere_match_formula(distance, score):
    assert atmosphere_match(distance) == approx(score)


def test_nearest_returns_the_closest_conditions_first(custom):
    far, near, middle = cond(10, 10, 50, 50, test="far"), cond(28, 28, 9, 9, test="near"), cond(27, 27, 10, 10, test="mid")
    result = nearest([far, near, middle], custom, 2)
    assert [c.test_id for c, _ in result] == ["near", "mid"]
    assert result[0][1].distance == 0.0


def test_report_conditions_become_conditions_marked_report(reference):
    items = conditions([], reference.report_conditions)
    assert {c.test_id for c in items} == {"19070K1", "19070D1", "19056F1"}
    assert {c.basis for c in items} == {"report"}
    assert {c.source_row for c in items} == {None}


# --- the real data -------------------------------------------------------------


def test_every_condition_comes_from_a_point_or_a_report(real_conditions):
    assert len(real_conditions) == 878 + 3
    assert sum(c.basis == "report" for c in real_conditions) == 3


def test_lunar_atmosphere_scores_on_the_real_data(entries, real_conditions, lunar, ranking_data):
    result = rank(entries, real_conditions, lunar, ranking_data)
    scores = {r.psi_id: (round(r.atmosphere_match, 1), r.tests_inside_zone, r.tests_with_conditions) for r in result.rows}
    assert scores == {
        "PSI-159": (100.0, 20, 179),
        "PSI-20": (100.0, 1, 3),
        "PSI-69": (98.7, 0, 273),
        "PSI-39": (70.0, 0, 79),
        "PSI-10": (65.7, 0, 207),
        "PSI-98": (49.8, 0, 2),
        "PSI-99": (49.8, 0, 9),
        "PSI-25": (48.8, 0, 129),
    }


def test_lunar_order_uses_atmosphere_then_material_then_id(entries, real_conditions, lunar, ranking_data):
    result = rank(entries, real_conditions, lunar, ranking_data)
    # PSI-20 and PSI-159 tie at 100 for atmosphere; PSI-20 wins on material (70 against 25).
    assert [r.psi_id for r in result.rows] == [
        "PSI-20", "PSI-159", "PSI-69", "PSI-39", "PSI-10", "PSI-98", "PSI-99", "PSI-25",
    ]


def test_lunar_material_relevance_on_the_real_data(entries, real_conditions, lunar, ranking_data):
    result = rank(entries, real_conditions, lunar, ranking_data)
    assert {r.psi_id: r.material_relevance for r in result.rows} == {
        "PSI-20": 70, "PSI-159": 25, "PSI-69": 40, "PSI-39": 40, "PSI-10": 25,
        "PSI-98": 100, "PSI-99": 100, "PSI-25": 100,
    }


def test_experiments_without_conditions_are_listed_not_scored_with_reasons(entries, real_conditions, lunar, ranking_data):
    result = rank(entries, real_conditions, lunar, ranking_data)
    assert {n.psi_id for n in result.not_scored} == {
        "PSI-21", "PSI-22", "PSI-23", "PSI-26", "PSI-47", "PSI-60", "PSI-62", "PSI-68", "PSI-100",
        "PSI-101", "PSI-102", "PSI-106", "PSI-107", "PSI-115", "PSI-117", "PSI-142",
    }
    assert len(result.rows) + len(result.not_scored) == 24
    reasons = {n.psi_id: n.reason for n in result.not_scored}
    assert reasons["PSI-100"] == "no per-test conditions in the tables loaded"
    assert reasons["PSI-117"] == "ground study: no test table of its own"
    by_id = {n.psi_id: n for n in result.not_scored}
    assert (by_id["PSI-47"].category, by_id["PSI-47"].material_relevance) == ("no_burning_test", 0)
    assert by_id["PSI-26"].material_relevance == 100


def test_not_scored_experiments_still_get_a_material_relevance(entries, real_conditions, lunar, ranking_data):
    result = rank(entries, real_conditions, lunar, ranking_data)
    assert all(isinstance(n.material_relevance, int) for n in result.not_scored)


def test_iss_scores_on_the_real_data(entries, real_conditions, iss, ranking_data):
    result = rank(entries, real_conditions, iss, ranking_data)
    scores = {r.psi_id: round(r.atmosphere_match, 1) for r in result.rows}
    assert scores["PSI-25"] == scores["PSI-69"] == scores["PSI-159"] == scores["PSI-39"] == 100.0
    assert scores["PSI-10"] == 99.7
    assert scores["PSI-99"] == 97.6
    assert all(r.tests_inside_zone is None for r in result.rows)


def test_custom_28_percent_9_psi_nearest_tests_on_the_real_data(real_conditions, custom):
    result = nearest(real_conditions, custom, 5)
    assert [(c.experiment_id, c.test_id) for c, _ in result] == [
        ("PSI-20", "19056F1"), ("PSI-20", "19070K1"), ("PSI-69", "41"), ("PSI-69", "43"), ("PSI-69", "42"),
    ]
    assert [round(g.distance, 3) for _, g in result] == [0.138, 0.144, 0.164, 0.165, 0.166]
    first = result[0][1]
    assert (first.o2_pct_points, first.psi) == approx((-1.0, 1.2))
    assert result[2][0].source_row == 42


# --- the reviewed tables -------------------------------------------------------


def test_the_rules_file_names_the_weighting_and_the_weights(ranking_data):
    assert ranking_data.rules.version == "ranking.v1"
    assert ranking_data.rules.weighting_label == "our weighting"
    assert {k: v.weight for k, v in ranking_data.rules.categories.items()} == {
        "solid": 100, "emulated_solid": 70, "liquid": 40, "gas": 25, "no_burning_test": 0,
    }


def test_there_is_one_fuel_category_per_registered_experiment_with_a_source(reference, ranking_data):
    registered = [e.psi_id for e in reference.registry.experiments]
    assert sorted(f.psi_id for f in ranking_data.fuel_categories) == sorted(registered)
    for entry in ranking_data.fuel_categories:
        assert entry.category in ranking_data.rules.categories, entry.psi_id
        assert entry.source.strip(), entry.psi_id


def test_psi_20_is_an_emulated_solid_by_the_challenge_text(ranking_data):
    entry = next(f for f in ranking_data.fuel_categories if f.psi_id == "PSI-20")
    assert entry.category == "emulated_solid"
    assert "materials flammability in still atmospheres" in entry.source
    assert "Challenge text" in entry.source


def test_material_relevance_comes_from_the_table_not_from_the_records_fuel_state(entries, real_conditions, lunar, ranking_data):
    # Re-label PSI-25 as gas in the table only: its record still says 'solid'.
    changed = [
        f.model_copy(update={"category": "gas"}) if f.psi_id == "PSI-25" else f for f in ranking_data.fuel_categories
    ]
    result = rank(entries, real_conditions, lunar, type(ranking_data)(ranking_data.rules, changed))
    assert next(r for r in result.rows if r.psi_id == "PSI-25").material_relevance == 25


def test_a_zone_habitat_counts_inside_with_the_same_rule_as_the_reference_code(entries, real_conditions, lunar, ranking_data):
    result = rank(entries, real_conditions, lunar, ranking_data)
    expected = sum(1 for c in real_conditions if c.experiment_id == "PSI-159" and in_zone(c.o2_min, c.psi_max, lunar))
    assert next(r for r in result.rows if r.psi_id == "PSI-159").tests_inside_zone == expected
