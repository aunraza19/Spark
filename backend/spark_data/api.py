import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from spark_data.paths import CLEAN_DIR, REFERENCE_DIR, WEB_DIST


def _read(directory: Path, name: str):
    return json.loads((directory / name).read_text(encoding="utf-8"))


def create_app(clean: Path = CLEAN_DIR, reference: Path = REFERENCE_DIR, web_dist: Path = WEB_DIST) -> FastAPI:
    habitats = _read(reference, "habitats.json")
    report_conditions = _read(reference, "report_conditions.json")
    points = _read(clean, "test_points.json")
    entries = {e["psi_id"]: e for e in _read(clean, "experiments.json")}

    app = FastAPI(title="Spark data")

    @app.get("/api/habitats")
    def get_habitats():
        return habitats

    @app.get("/api/points")
    def get_points():
        return points

    @app.get("/api/report-conditions")
    def get_report_conditions():
        return report_conditions

    @app.get("/api/experiments")
    def get_experiments():
        return [
            {
                "psi_id": e["psi_id"],
                "kind": e["kind"],
                "status": e["status"],
                "test_table": e["test_table"],
                "name": e["record"]["name"] if e["record"] else None,
                "acronym": e["record"]["acronym"] if e["record"] else None,
                "fuel_state": e["record"]["fuel_state"] if e["record"] else None,
            }
            for e in entries.values()
        ]

    @app.get("/api/experiments/{psi_id}")
    def get_experiment(psi_id: str):
        if psi_id not in entries:
            raise HTTPException(status_code=404, detail="unknown experiment")
        return entries[psi_id]

    if (web_dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")

    return app
