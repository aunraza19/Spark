import math
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.paths import CLEAN_DIR, REFERENCE_DIR, WEB_DIST
from spark_data.snapshots import build_map_snapshot, snapshot_key


def create_app(clean: Path = CLEAN_DIR, reference: Path = REFERENCE_DIR, web_dist: Path = WEB_DIST) -> FastAPI:
    data = load_data(clean, reference)

    app = FastAPI(title="Spark data")

    @app.get("/api/habitats")
    def get_habitats():
        return [h.model_dump(exclude_none=True) for h in data.habitats]

    @app.get("/api/points")
    def get_points():
        return data.points

    @app.get("/api/report-conditions")
    def get_report_conditions():
        return [c.model_dump(exclude_none=True) for c in data.report_conditions]

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
            for e in data.entries.values()
        ]

    @app.get("/api/experiments/{psi_id}")
    def get_experiment(psi_id: str):
        if psi_id not in data.entries:
            raise HTTPException(status_code=404, detail="unknown experiment")
        return data.entries[psi_id]

    @app.get("/api/snapshot/map")
    def get_map_snapshot(habitat: str, o2: float | None = None, psi: float | None = None):
        if habitat == "custom":
            valid = o2 is not None and psi is not None and 0 < o2 <= 100 and 0 < psi and math.isfinite(psi)
            if not valid:
                raise HTTPException(
                    status_code=422, detail="custom needs oxygen above 0 and up to 100 %, and pressure above 0 psi"
                )
            target = Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")
        else:
            target = next((h for h in data.habitats if h.id == habitat and h.kind != "note"), None)
            if target is None:
                raise HTTPException(status_code=404, detail="unknown habitat")
        snapshot = build_map_snapshot(data, target)
        return {"key": snapshot_key(snapshot), "snapshot": snapshot}

    if (web_dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")

    return app
