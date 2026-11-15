import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pytest import approx
from spark_data.api import create_app
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.snapshots import build_scenario_snapshot, snapshot_key

REPO = Path(__file__).resolve().parents[1]
CLEAN = REPO / "data" / "clean"
REFERENCE = REPO / "data" / "reference"


@pytest.fixture(scope="module")
def data():
    return load_data(CLEAN, REFERENCE)


def custom(o2, psi):
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")


def test_the_scenario_snapshot_names_the_panel_and_the_target(data):
    snap = build_scenario_snapshot(data, custom(28.0, 9.0))
    assert set(snap) == {"schema", "data_version", "panel", "habitat", "view"}
    assert (snap["schema"], snap["panel"], snap["data_version"]) == ("spark.snapshot.v1", "scenario", data.data_version)
    assert snap["habitat"] == {"id": "custom", "kind": "point", "o2_pct": 28.0, "pressure_psi": 9.0, "source": "User input"}


def test_the_nearest_five_tests_for_28_percent_and_9_psi(data):
    view = build_scenario_snapshot(data, custom(28.0, 9.0))["view"]
    nearest = view["nearest_tests"]
    assert [(n["experiment_id"], n["test_id"]) for n in nearest] == [
        ("PSI-20", "19056F1"), ("PSI-20", "19070K1"), ("PSI-69", "41"), ("PSI-69", "43"), ("PSI-69", "42"),
    ]
    assert [n["distance"] for n in nearest] == approx([0.138, 0.144, 0.164, 0.165, 0.166], abs=5e-4)
    first = nearest[0]
    assert (first["basis"], first["o2_pct"], first["pressure_psi"]) == ("report", 27, 10.2)
    assert (first["gap_o2_pct_points"], first["gap_psi"]) == approx((-1.0, 1.2))
    assert (first["source_file"], first["source_row"]) == ("BRE_final_report_20220201.pdf", None)
    third = nearest[2]
    assert (third["basis"], third["source_file"], third["source_row"]) == ("test", "PSI-69_Experimental table_FLEX.csv", 42)
    assert (third["gap_o2_pct_points"], third["gap_psi"]) == approx((2.0, 1.332))


def test_no_test_was_run_at_28_percent_and_9_psi(data):
    view = build_scenario_snapshot(data, custom(28.0, 9.0))["view"]
    assert view["tests_at_target"] == 0
    assert view["inside_lunar_zone"] is False


def test_a_target_taken_from_a_report_condition_has_a_test_at_it_and_is_inside_the_zone(data):
    # BRE test 19070D1: 34 % oxygen at 8.2 psi.
    view = build_scenario_snapshot(data, custom(34.0, 8.2))["view"]
    assert view["tests_at_target"] >= 1
    assert view["nearest_tests"][0]["distance"] == 0
    assert view["inside_lunar_zone"] is True


@pytest.mark.parametrize("o2, psi, inside", [(30.0, 10.2, True), (29.99, 10.2, False), (30.0, 10.21, False)])
def test_the_lunar_zone_check_has_inclusive_bounds(data, o2, psi, inside):
    assert build_scenario_snapshot(data, custom(o2, psi))["view"]["inside_lunar_zone"] is inside


def test_the_distance_rule_text_comes_from_the_rules_file(data):
    rules = json.loads((REFERENCE / "ranking_rules.json").read_text(encoding="utf-8"))
    assert build_scenario_snapshot(data, custom(28.0, 9.0))["view"]["distance_rule"] == rules["distance_rule"]


def test_a_zone_habitat_cannot_be_a_scenario(data):
    lunar = next(h for h in data.habitats if h.id == "lunar")
    with pytest.raises(ValueError):
        build_scenario_snapshot(data, lunar)


def test_every_float_has_at_most_3_decimals_and_the_key_follows_the_target(data):
    text = json.dumps(build_scenario_snapshot(data, custom(28.0, 9.0)))
    for number in re.findall(r"\d+\.\d+", text):
        assert len(number.split(".")[1]) <= 3, number
    one = snapshot_key(build_scenario_snapshot(data, custom(28.0, 9.0)))
    assert snapshot_key(build_scenario_snapshot(data, custom(28.0, 9.0))) == one
    assert snapshot_key(build_scenario_snapshot(data, custom(28.0, 9.5))) != one


# --- the endpoint ----------------------------------------------------------------


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


def test_the_endpoint_returns_the_scenario_snapshot_and_its_key(client):
    response = client.get("/api/snapshot/scenario", params={"o2": 28, "psi": 9})
    assert response.status_code == 200
    body = response.json()
    assert body["snapshot"]["panel"] == "scenario"
    assert body["snapshot"]["view"]["nearest_tests"][0]["test_id"] == "19056F1"
    assert body["key"] == snapshot_key(body["snapshot"])


@pytest.mark.parametrize(
    "params",
    [{}, {"o2": 28}, {"psi": 9}, {"o2": 0, "psi": 9}, {"o2": 101, "psi": 9}, {"o2": 28, "psi": 0},
     {"o2": 28, "psi": -3}, {"o2": "abc", "psi": 9}, {"o2": 28, "psi": "inf"}],
)
def test_a_bad_scenario_is_rejected_with_422(client, params):
    assert client.get("/api/snapshot/scenario", params=params).status_code == 422
