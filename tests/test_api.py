import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pytest import approx
from spark_data.api import create_app

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


def test_habitats_are_the_three_reference_entries(client):
    response = client.get("/api/habitats")
    assert response.status_code == 200
    habitats = {h["id"]: h for h in response.json()}
    assert set(habitats) == {"lunar", "iss", "spacesuit"}
    assert habitats["lunar"]["kind"] == "zone"
    assert habitats["lunar"]["o2_pct_min"] == approx(30)
    assert habitats["lunar"]["pressure_psi_max"] == approx(10.2)
    assert "Challenge text" in habitats["lunar"]["source"]
    assert habitats["iss"]["kind"] == "point"
    assert (habitats["iss"]["o2_pct"], habitats["iss"]["pressure_psi"]) == approx((21, 14.7))


def test_points_are_the_878_ambient_points(client):
    points = client.get("/api/points").json()
    assert len(points) == 878
    assert {"experiment_id", "test_id", "o2_pct_min", "o2_pct_max", "pressure_psi_min", "pressure_psi_max",
            "fuel_state", "pressure_basis", "source_file", "source_row"} <= set(points[0])
    counts = {}
    for p in points:
        counts[p["experiment_id"]] = counts.get(p["experiment_id"], 0) + 1
    assert counts == {"PSI-10": 207, "PSI-25": 129, "PSI-39": 79, "PSI-69": 273,
                      "PSI-98": 2, "PSI-99": 9, "PSI-159": 179}


def test_points_never_include_burner_points(client):
    points = client.get("/api/points").json()
    assert not any("Inverse" in p["source_file"] for p in points)
    assert client.get("/api/burner-points").status_code == 404


def test_points_keep_the_unrounded_values_from_data_clean(client):
    first = client.get("/api/points").json()[0]
    # PSI-10 normal, test 19115A1: XO2 (init) 0.207128374 in the raw table.
    assert first["test_id"] == "19115A1"
    assert first["o2_pct_min"] == approx(20.7128374)
    assert first["o2_pct_min"] != round(first["o2_pct_min"], 3)


def test_report_conditions_are_the_three_bre_entries(client):
    conditions = client.get("/api/report-conditions").json()
    assert {c["test_id"] for c in conditions} == {"19070K1", "19070D1", "19056F1"}
    assert {c["source"]["file"] for c in conditions} == {"BRE_final_report_20220201.pdf"}


def test_experiments_list_has_all_24(client):
    experiments = client.get("/api/experiments").json()
    assert len(experiments) == 24
    assert [e["kind"] for e in experiments].count("flight") == 19
    assert [e["kind"] for e in experiments].count("ground") == 5
    psi159 = next(e for e in experiments if e["psi_id"] == "PSI-159")
    assert psi159["acronym"] == "ACME CFI-G"
    assert psi159["fuel_state"] == "gas"
    assert psi159["status"] == "loaded"


def test_experiment_detail_returns_the_record_without_temperature(client):
    detail = client.get("/api/experiments/PSI-159").json()
    assert detail["psi_id"] == "PSI-159"
    assert detail["record"]["objective"]
    assert "ambient_temperature_K" not in detail["record"]
    assert len(detail["record"]["sensors"]) == 6


@pytest.mark.parametrize("path", ["/api/experiments/PSI-999", "/api/experiments/abc"])
def test_unknown_experiment_is_404(client, path):
    assert client.get(path).status_code == 404


def test_the_api_is_read_only(client):
    assert client.post("/api/points", json={}).status_code == 405
    assert client.delete("/api/experiments/PSI-159").status_code == 405


def test_missing_data_fails_at_startup_with_a_clear_error(tmp_path):
    with pytest.raises(FileNotFoundError):
        create_app(tmp_path, tmp_path)


def test_serving_does_not_modify_the_data_files():
    def fingerprint():
        return {
            str(p.relative_to(REPO)): hashlib.sha256(p.read_bytes()).hexdigest()
            for folder in ("clean", "reference")
            for p in (REPO / "data" / folder).glob("*.json")
        }

    before = fingerprint()
    local = TestClient(create_app())
    for path in ("/api/habitats", "/api/points", "/api/experiments", "/api/report-conditions"):
        local.get(path)
    assert fingerprint() == before
