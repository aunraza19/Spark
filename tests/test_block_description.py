from pathlib import Path

import pytest
from spark_data.block_snapshots import BadBlock, names_for, snapshot_for
from spark_data.data import load_data
from spark_data.snapshots import build_map_snapshot

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


@pytest.mark.parametrize(
    "spec, panel",
    [
        ({"kind": "map", "habitat": "lunar", "shown_psi_max": 20}, "map"),
        ({"kind": "map", "habitat": "custom", "o2": 34, "psi": 8.2}, "map"),
        ({"kind": "scenario", "o2": 34, "psi": 8.2}, "scenario"),
        ({"kind": "ranking", "habitat": "iss"}, "ranking"),
        ({"kind": "experiment", "experiment_id": "PSI-25"}, "experiment"),
    ],
)
def test_each_kind_of_block_gives_its_own_snapshot_and_names(data, spec, panel):
    snapshot, names = snapshot_for(data, spec)
    assert snapshot["panel"] == panel
    assert names == names_for(data, snapshot)


def test_the_map_block_snapshot_is_the_existing_map_snapshot_plus_outcomes(data):
    snapshot, _ = snapshot_for(data, {"kind": "map", "habitat": "lunar", "shown_psi_max": 20})
    lunar = next(h for h in data.habitats if h.id == "lunar")
    assert {k: v for k, v in snapshot.items() if k != "outcomes"} == build_map_snapshot(data, lunar, 20)


@pytest.mark.parametrize(
    "spec, status",
    [
        ({"kind": "nonsense"}, 422),
        ({}, 422),
        ({"kind": "map"}, 422),
        ({"kind": "map", "habitat": "mars"}, 404),
        ({"kind": "map", "habitat": "spacesuit"}, 404),
        ({"kind": "map", "habitat": "custom"}, 422),
        ({"kind": "map", "habitat": "custom", "o2": 0, "psi": 9}, 422),
        ({"kind": "scenario"}, 422),
        ({"kind": "scenario", "o2": 120, "psi": 9}, 422),
        ({"kind": "ranking", "habitat": "mars"}, 404),
        ({"kind": "experiment"}, 422),
        ({"kind": "experiment", "experiment_id": "PSI-999"}, 404),
    ],
)
def test_a_bad_block_description_is_refused_with_the_right_status(data, spec, status):
    with pytest.raises(BadBlock) as error:
        snapshot_for(data, spec)
    assert error.value.status == status
