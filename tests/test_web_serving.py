from fastapi.testclient import TestClient
from spark_data.api import create_app


def make_dist(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html><title>spark</title></html>", encoding="utf-8")
    (dist / "assets" / "app.js").write_text("console.log('spark')", encoding="utf-8")
    return dist


def test_the_api_serves_the_built_frontend_at_the_root(tmp_path):
    client = TestClient(create_app(web_dist=make_dist(tmp_path)))
    root = client.get("/")
    assert root.status_code == 200
    assert "<title>spark</title>" in root.text
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200
    assert "console.log" in asset.text


def test_serving_the_frontend_does_not_hide_the_api(tmp_path):
    client = TestClient(create_app(web_dist=make_dist(tmp_path)))
    assert client.get("/api/habitats").status_code == 200
    assert client.get("/api/nothing").status_code == 404


def test_without_a_build_the_root_is_404_and_the_api_still_works(tmp_path):
    client = TestClient(create_app(web_dist=tmp_path / "missing"))
    assert client.get("/").status_code == 404
    assert client.get("/api/habitats").status_code == 200
