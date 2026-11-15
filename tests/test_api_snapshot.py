import pytest
from fastapi.testclient import TestClient
from spark_data.api import create_app
from spark_data.snapshots import snapshot_key


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


def test_the_map_snapshot_endpoint_returns_the_snapshot_and_its_key(client):
    response = client.get("/api/snapshot/map", params={"habitat": "lunar"})
    assert response.status_code == 200
    body = response.json()
    assert body["snapshot"]["panel"] == "map"
    assert body["snapshot"]["habitat"]["id"] == "lunar"
    assert body["snapshot"]["view"]["inside_zone"]["test_points"] == 20
    assert body["key"] == snapshot_key(body["snapshot"])


def test_the_iss_is_a_valid_selection(client):
    assert client.get("/api/snapshot/map", params={"habitat": "iss"}).status_code == 200


def test_a_custom_selection_uses_the_given_oxygen_and_pressure(client):
    response = client.get("/api/snapshot/map", params={"habitat": "custom", "o2": 28, "psi": 9})
    assert response.status_code == 200
    habitat = response.json()["snapshot"]["habitat"]
    assert (habitat["id"], habitat["o2_pct"], habitat["pressure_psi"]) == ("custom", 28.0, 9.0)


@pytest.mark.parametrize(
    "params",
    [
        {"habitat": "custom"},
        {"habitat": "custom", "o2": 28},
        {"habitat": "custom", "psi": 9},
        {"habitat": "custom", "o2": 0, "psi": 9},
        {"habitat": "custom", "o2": 101, "psi": 9},
        {"habitat": "custom", "o2": 28, "psi": 0},
        {"habitat": "custom", "o2": 28, "psi": -3},
        {"habitat": "custom", "o2": "abc", "psi": 9},
    ],
)
def test_a_bad_custom_selection_is_rejected_with_422(client, params):
    assert client.get("/api/snapshot/map", params=params).status_code == 422


@pytest.mark.parametrize("name", ["mars", "spacesuit", ""])
def test_an_unknown_or_note_only_habitat_is_404(client, name):
    assert client.get("/api/snapshot/map", params={"habitat": name}).status_code == 404


def test_the_same_request_gives_the_same_key(client):
    one = client.get("/api/snapshot/map", params={"habitat": "custom", "o2": 28, "psi": 9}).json()["key"]
    two = client.get("/api/snapshot/map", params={"habitat": "custom", "o2": 28, "psi": 9}).json()["key"]
    other = client.get("/api/snapshot/map", params={"habitat": "custom", "o2": 28, "psi": 9.5}).json()["key"]
    assert one == two != other
