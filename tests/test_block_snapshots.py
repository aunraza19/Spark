import json
import re
from pathlib import Path

import pytest
from spark_data.block_snapshots import (
    build_experiment_snapshot,
    build_ranking_snapshot,
    names_for,
)
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.pages import experiment_page, ranking_view
from spark_data.snapshots import SCHEMA, build_map_snapshot, snapshot_key

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


def habitat(data, name):
    return next(h for h in data.habitats if h.id == name)


def custom(o2, psi):
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")


def decimals(value):
    if isinstance(value, float):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from decimals(v)
    elif isinstance(value, list):
        for v in value:
            yield from decimals(v)


# --- the ranking snapshot ----------------------------------------------------------


def test_the_ranking_snapshot_carries_the_schema_the_data_version_and_the_target(data):
    snapshot = build_ranking_snapshot(data, habitat(data, "lunar"))
    assert snapshot["schema"] == SCHEMA
    assert snapshot["panel"] == "ranking"
    assert snapshot["data_version"] == data.data_version
    assert snapshot["habitat"]["id"] == "lunar"
    assert snapshot["habitat"]["o2_pct_min"] == 30


def test_the_ranking_snapshot_holds_the_rows_the_unscored_experiments_and_the_rules(data):
    view = ranking_view(data, habitat(data, "lunar"))
    snapshot = build_ranking_snapshot(data, habitat(data, "lunar"))
    assert snapshot["lead"] == view["lead"]
    assert [r["psi_id"] for r in snapshot["rows"]] == [r["psi_id"] for r in view["rows"]]
    assert [r["rank"] for r in snapshot["rows"]] == list(range(1, len(view["rows"]) + 1))
    assert [n["psi_id"] for n in snapshot["not_scored"]] == [n["psi_id"] for n in view["not_scored"]]
    assert snapshot["evidence"]["weights"] == view["evidence"]["weights"]
    assert snapshot["evidence"]["distance_rule"] == view["evidence"]["distance_rule"]


def test_the_ranking_snapshot_is_rounded_to_three_decimals(data):
    snapshot = build_ranking_snapshot(data, custom(28.123456, 9.987654))
    for value in decimals(snapshot):
        assert value == round(value, 3)


def test_the_ranking_snapshot_has_a_stable_key_that_follows_the_target(data):
    a = snapshot_key(build_ranking_snapshot(data, habitat(data, "lunar")))
    assert a == snapshot_key(build_ranking_snapshot(data, habitat(data, "lunar")))
    assert a != snapshot_key(build_ranking_snapshot(data, habitat(data, "iss")))
    assert snapshot_key(build_ranking_snapshot(data, custom(28, 9))) != snapshot_key(build_ranking_snapshot(data, custom(28, 9.5)))


# --- the experiment snapshot -------------------------------------------------------


def test_the_experiment_snapshot_carries_the_schema_the_version_and_the_experiment(data):
    snapshot = build_experiment_snapshot(data, "PSI-25")
    assert snapshot["schema"] == SCHEMA
    assert snapshot["panel"] == "experiment"
    assert snapshot["data_version"] == data.data_version
    assert snapshot["experiment"]["psi_id"] == "PSI-25"
    assert snapshot["experiment"]["title"] == "BASS-II (PSI-25)"


def test_the_experiment_snapshot_holds_the_record_as_it_is_and_the_conditions(data):
    page = experiment_page(data, "PSI-25")
    record = data.entries["PSI-25"]["record"]
    experiment = build_experiment_snapshot(data, "PSI-25")["experiment"]
    assert experiment["lead"] == page["lead"]
    assert experiment["key_results"] == record["key_results"]
    assert experiment["data_quality_notes"] == record["data_quality_notes"]
    assert experiment["fuels"] == record["fuel"]
    assert experiment["sensors"] == record["sensors"]
    assert experiment["conditions"]["tests_on_map"] == page["evidence"]["conditions"]["tests_on_map"]
    assert experiment["conditions"]["ranges"] == page["evidence"]["conditions"]["ranges"]
    assert experiment["publication_count"] == len(record["publications"])


def test_the_experiment_snapshot_is_rounded_and_keyed(data):
    for psi_id in data.entries:
        snapshot = build_experiment_snapshot(data, psi_id)
        for value in decimals(snapshot):
            assert value == round(value, 3)
    assert snapshot_key(build_experiment_snapshot(data, "PSI-25")) != snapshot_key(build_experiment_snapshot(data, "PSI-159"))
    assert snapshot_key(build_experiment_snapshot(data, "PSI-25")) == snapshot_key(build_experiment_snapshot(data, "PSI-25"))


def test_an_unknown_experiment_has_no_snapshot(data):
    assert build_experiment_snapshot(data, "PSI-999") is None


# --- names -------------------------------------------------------------------------


def test_names_give_a_title_and_the_fuel_type_for_each_experiment_in_a_snapshot(data):
    snapshot = build_ranking_snapshot(data, habitat(data, "lunar"))
    names = names_for(data, snapshot)
    ids = set(re.findall(r"PSI-\d+", json.dumps(snapshot)))
    assert set(names) == ids
    assert names["PSI-25"] == {"title": "BASS-II (PSI-25)", "fuel_type": "Solid material"}


def test_names_work_for_a_map_snapshot(data):
    snapshot = build_map_snapshot(data, habitat(data, "lunar"), 20)
    names = names_for(data, snapshot)
    assert names
    assert all(set(v) == {"title", "fuel_type"} for v in names.values())
