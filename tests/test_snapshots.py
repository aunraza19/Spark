import json
import re
from pathlib import Path

import pytest
from pytest import approx
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.snapshots import (
    build_map_snapshot,
    data_version,
    round_numbers,
    snapshot_key,
)

REPO = Path(__file__).resolve().parents[1]
CLEAN = REPO / "data" / "clean"
REFERENCE = REPO / "data" / "reference"


@pytest.fixture(scope="module")
def data():
    return load_data(CLEAN, REFERENCE)


def habitat(data, name):
    return next(h for h in data.habitats if h.id == name)


def custom(o2, psi):
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")


# --- the data version and the key ----------------------------------------------


def test_data_version_is_12_hex_characters_and_follows_the_file_bytes(tmp_path):
    clean, reference = tmp_path / "clean", tmp_path / "reference"
    clean.mkdir()
    reference.mkdir()
    (clean / "a.json").write_text("[1]", encoding="utf-8")
    (reference / "b.json").write_text("[2]", encoding="utf-8")
    first = data_version(clean, reference)
    assert re.fullmatch(r"[0-9a-f]{12}", first)
    assert data_version(clean, reference) == first
    (reference / "b.json").write_text("[3]", encoding="utf-8")
    assert data_version(clean, reference) != first


def test_the_real_data_version_is_12_hex_characters(data):
    assert re.fullmatch(r"[0-9a-f]{12}", data.data_version)
    assert data.data_version == data_version(CLEAN, REFERENCE)


def test_snapshot_key_ignores_key_order_and_changes_with_a_value():
    a = {"panel": "map", "view": {"x": 1, "y": [1, 2]}}
    b = {"view": {"y": [1, 2], "x": 1}, "panel": "map"}
    assert snapshot_key(a) == snapshot_key(b)
    assert snapshot_key(a) != snapshot_key({"panel": "map", "view": {"x": 2, "y": [1, 2]}})
    assert re.fullmatch(r"[0-9a-f]{64}", snapshot_key(a))


def test_numbers_are_rounded_to_3_decimals_and_integers_are_untouched():
    assert round_numbers({"x": 10.3321234, "y": [1.23456, 7], "ok": True, "s": "1.23456"}) == {
        "x": 10.332, "y": [1.235, 7], "ok": True, "s": "1.23456",
    }


# --- the map snapshot on the real data -----------------------------------------


def test_the_map_snapshot_for_the_lunar_zone(data):
    snap = build_map_snapshot(data, habitat(data, "lunar"))
    assert set(snap) == {"schema", "data_version", "panel", "habitat", "view"}
    assert (snap["schema"], snap["panel"], snap["data_version"]) == ("spark.snapshot.v1", "map", data.data_version)
    assert snap["habitat"] == {
        "id": "lunar", "kind": "zone", "o2_pct_min": 30.0, "pressure_psi_max": 10.2,
        "source": "Challenge text: 30% oxygen or more at 10.2 psi or less. Bounds are inclusive.",
    }
    view = snap["view"]
    assert (view["ambient_points_shown"], view["burner_points_hidden"], view["report_conditions_shown"]) == (878, 263, 3)
    assert view["inside_zone"] == {
        "test_points": 20,
        "by_experiment": {"PSI-159": 20},
        "report_conditions": [{"experiment_id": "PSI-20", "test_id": "19070D1"}],
    }


def test_the_lunar_snapshot_lists_the_closest_experiments_outside_the_zone(data):
    near = build_map_snapshot(data, habitat(data, "lunar"))["view"]["nearest_outside_zone"]
    assert [(n["experiment_id"], n["test_id"]) for n in near] == [("PSI-69", "37"), ("PSI-20", "19056F1"), ("PSI-39", "1356")]
    first = near[0]
    assert (first["o2_pct"], first["pressure_psi"], first["gap_o2_pct_points"], first["gap_psi"]) == approx((34.0, 10.332, 0.0, 0.132))
    assert (first["source_file"], first["source_row"], first["basis"]) == ("PSI-69_Experimental table_FLEX.csv", 38, "test")
    report = near[1]
    assert (report["basis"], report["source_file"], report["source_row"]) == ("report", "BRE_final_report_20220201.pdf", None)
    assert report["gap_o2_pct_points"] == approx(3.0)


def test_the_lunar_snapshot_lists_the_experiments_without_conditions(data):
    view = build_map_snapshot(data, habitat(data, "lunar"))["view"]
    assert view["experiments_without_conditions"] == [
        "PSI-21", "PSI-22", "PSI-23", "PSI-26", "PSI-47", "PSI-60", "PSI-62", "PSI-68",
        "PSI-100", "PSI-101", "PSI-102", "PSI-106", "PSI-107", "PSI-115", "PSI-117", "PSI-142",
    ]


def test_a_point_habitat_has_nearest_tests_and_no_zone_block(data):
    view = build_map_snapshot(data, habitat(data, "iss"))["view"]
    assert "inside_zone" not in view and "nearest_outside_zone" not in view
    nearest = view["nearest_tests_by_experiment"]
    assert len(nearest) == 3
    assert all(n["distance"] < 0.01 for n in nearest)


def test_a_custom_habitat_snapshot_names_the_target_and_the_nearest_tests(data):
    snap = build_map_snapshot(data, custom(28.0, 9.0))
    assert snap["habitat"] == {"id": "custom", "kind": "point", "o2_pct": 28.0, "pressure_psi": 9.0, "source": "User input"}
    nearest = snap["view"]["nearest_tests_by_experiment"]
    assert [(n["experiment_id"], n["test_id"]) for n in nearest][:2] == [("PSI-20", "19056F1"), ("PSI-69", "41")]
    assert nearest[0]["distance"] == approx(0.138, abs=5e-4)


def test_burner_points_are_never_counted_in_the_snapshot(data):
    view = build_map_snapshot(data, habitat(data, "lunar"))["view"]
    assert view["ambient_points_shown"] == 878
    assert set(view["inside_zone"]["by_experiment"]) == {"PSI-159"}


def test_the_same_selection_gives_the_same_key_and_another_selection_does_not(data):
    first = snapshot_key(build_map_snapshot(data, custom(28.0, 9.0)))
    assert snapshot_key(build_map_snapshot(data, custom(28.0, 9.0))) == first
    assert snapshot_key(build_map_snapshot(data, custom(28.0, 9.5))) != first


def test_every_float_in_a_snapshot_has_at_most_3_decimals(data):
    for target in (habitat(data, "lunar"), habitat(data, "iss"), custom(28.0, 9.0)):
        text = json.dumps(build_map_snapshot(data, target))
        for number in re.findall(r"\d+\.\d+", text):
            assert len(number.split(".")[1]) <= 3, number
