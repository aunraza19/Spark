import dataclasses
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from spark_data.api import create_app
from spark_data.data import load_data
from spark_data.snapshots import build_map_snapshot, snapshot_key

REPO = Path(__file__).resolve().parents[1]
CLEAN = REPO / "data" / "clean"
REFERENCE = REPO / "data" / "reference"


@pytest.fixture(scope="module")
def data():
    return load_data(CLEAN, REFERENCE)


@pytest.fixture(scope="module")
def lunar(data):
    return next(h for h in data.habitats if h.id == "lunar")


def above(limit):
    """Counts read straight from the files, not from the code under test."""
    points = json.loads((CLEAN / "test_points.json").read_text(encoding="utf-8"))
    reports = json.loads((REFERENCE / "report_conditions.json").read_text(encoding="utf-8"))
    return (
        sum(p["pressure_psi_max"] > limit for p in points),
        sum(c["pressure_psi_max"] > limit for c in reports),
    )


def test_without_a_view_the_snapshot_has_no_view_fields(data, lunar):
    view = build_map_snapshot(data, lunar)["view"]
    assert "pressure_range_shown" not in view
    assert "points_not_shown" not in view


def test_the_zoomed_view_records_the_range_and_the_hidden_counts(data, lunar):
    view = build_map_snapshot(data, lunar, shown_psi_max=20)["view"]
    assert view["pressure_range_shown"] == [0, 20]
    assert (view["points_not_shown"], view["report_conditions_not_shown"]) == above(20) == (82, 0)


def test_the_full_view_hides_nothing(data, lunar):
    view = build_map_snapshot(data, lunar, shown_psi_max=80)["view"]
    assert view["pressure_range_shown"] == [0, 80]
    assert (view["points_not_shown"], view["report_conditions_not_shown"]) == (0, 0)


def test_a_tighter_range_counts_the_report_conditions_too(data, lunar):
    view = build_map_snapshot(data, lunar, shown_psi_max=10)["view"]
    assert (view["points_not_shown"], view["report_conditions_not_shown"]) == above(10)
    assert view["report_conditions_not_shown"] == 2


def test_a_point_exactly_at_the_limit_is_shown(data, lunar):
    base = data.points[0]
    at_limit = {**base, "pressure_psi_min": 20.0, "pressure_psi_max": 20.0}
    over = {**base, "pressure_psi_min": 20.001, "pressure_psi_max": 20.001}
    small = dataclasses.replace(data, points=[at_limit, over])
    assert build_map_snapshot(small, lunar, shown_psi_max=20)["view"]["points_not_shown"] == 1


def test_the_key_follows_what_the_user_sees(data, lunar):
    zoomed = snapshot_key(build_map_snapshot(data, lunar, shown_psi_max=20))
    assert snapshot_key(build_map_snapshot(data, lunar, shown_psi_max=20)) == zoomed
    assert snapshot_key(build_map_snapshot(data, lunar, shown_psi_max=80)) != zoomed
    assert snapshot_key(build_map_snapshot(data, lunar)) != zoomed


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


def test_the_endpoint_records_the_view(client):
    body = client.get("/api/snapshot/map", params={"habitat": "lunar", "shown_psi_max": 20}).json()
    view = body["snapshot"]["view"]
    assert (view["pressure_range_shown"], view["points_not_shown"]) == ([0, 20], 82)
    assert body["key"] == snapshot_key(body["snapshot"])


def test_the_endpoint_records_the_view_for_a_custom_target_too(client):
    params = {"habitat": "custom", "o2": 28, "psi": 30, "shown_psi_max": 80}
    view = client.get("/api/snapshot/map", params=params).json()["snapshot"]["view"]
    assert (view["pressure_range_shown"], view["points_not_shown"]) == ([0, 80], 0)


@pytest.mark.parametrize("value", ["0", "-5", "abc", "inf", "nan"])
def test_a_bad_view_limit_is_rejected_with_422(client, value):
    assert client.get("/api/snapshot/map", params={"habitat": "lunar", "shown_psi_max": value}).status_code == 422
