import json
import math
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from spark_data.agent.chat import run_chat
from spark_data.agent.explain import AnswerCache, explain
from spark_data.agent.files import load_files
from spark_data.agent.limits import LIMITED, Limiter
from spark_data.agent.model import GeminiModel, ModelError, NoModel, Unavailable
from spark_data.agent.settings import load_settings
from spark_data.block_snapshots import BadBlock, resolve_target, snapshot_for
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.pages import experiment_list, experiment_page, ranking_view
from spark_data.paths import AGENT_CACHE_DIR, CLEAN_DIR, REFERENCE_DIR, WEB_DIST
from spark_data.plain import about, map_summary, point_card
from spark_data.snapshots import (
    build_map_snapshot,
    build_scenario_snapshot,
    snapshot_key,
)


class ExplainRequest(BaseModel):
    block: dict


class ChatRequest(BaseModel):
    block: dict
    messages: list[dict]


def create_app(
    clean: Path = CLEAN_DIR,
    reference: Path = REFERENCE_DIR,
    web_dist: Path = WEB_DIST,
    settings=None,
    model=None,
    agent_cache=None,
    agent_files=None,
) -> FastAPI:
    data = load_data(clean, reference)

    app = FastAPI(title="Spark data")

    def _target(habitat: str, o2: float | None, psi: float | None) -> Habitat:
        try:
            return resolve_target(data, habitat, o2, psi)
        except BadBlock as error:
            raise HTTPException(status_code=error.status, detail=str(error)) from None

    files = agent_files or load_files()
    cache = AnswerCache(agent_cache or AGENT_CACHE_DIR)
    agent_settings = settings or load_settings()
    live: dict = {"model": model}
    limiter = Limiter(agent_settings.limit_per_hour, agent_settings.limit_per_day)

    def allowed(request: Request) -> bool:
        # Behind Cloud Run the first X-Forwarded-For entry is the visitor.
        forwarded = request.headers.get("x-forwarded-for")
        visitor = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        return limiter.allow(visitor)

    def agent_model():
        if live["model"] is None:
            live["model"] = GeminiModel(agent_settings) if agent_settings.configured() else NoModel(agent_settings.model)
        return live["model"]

    def block_snapshot(block: dict):
        try:
            return snapshot_for(data, block)
        except BadBlock as error:
            raise HTTPException(status_code=error.status, detail=str(error)) from None

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

    @app.get("/api/experiment-list")
    def get_experiment_list():
        return experiment_list(data)

    @app.get("/api/experiment-page/{psi_id}")
    def get_experiment_page(psi_id: str):
        page = experiment_page(data, psi_id)
        if page is None:
            raise HTTPException(status_code=404, detail="unknown experiment")
        return page

    @app.get("/api/ranking")
    def get_ranking(habitat: str, o2: float | None = None, psi: float | None = None):
        return ranking_view(data, _target(habitat, o2, psi))

    @app.get("/api/snapshot/map")
    def get_map_snapshot(
        habitat: str, o2: float | None = None, psi: float | None = None, shown_psi_max: float | None = None
    ):
        if shown_psi_max is not None and not (shown_psi_max > 0 and math.isfinite(shown_psi_max)):
            raise HTTPException(status_code=422, detail="shown_psi_max must be above 0 psi")
        target = _target(habitat, o2, psi)
        snapshot = build_map_snapshot(data, target, shown_psi_max)
        return {"key": snapshot_key(snapshot), "snapshot": snapshot, "summary": map_summary(data, target)}

    @app.get("/api/snapshot/scenario")
    def get_scenario_snapshot(o2: float | None = None, psi: float | None = None):
        snapshot = build_scenario_snapshot(data, _target("custom", o2, psi))
        return {"key": snapshot_key(snapshot), "snapshot": snapshot}

    @app.get("/api/about")
    def get_about():
        return about(data)

    @app.get("/api/point-card")
    def get_point_card(
        source_file: str | None = None,
        source_row: int | None = None,
        experiment_id: str | None = None,
        test_id: str | None = None,
    ):
        if source_file is not None and source_row is not None:
            card = point_card(data, source_file, source_row, None, None)
        elif experiment_id is not None and test_id is not None:
            card = point_card(data, None, None, experiment_id, test_id)
        else:
            raise HTTPException(status_code=422, detail="give source_file and source_row, or experiment_id and test_id")
        if card is None:
            raise HTTPException(status_code=404, detail="unknown test")
        return card

    @app.post("/api/agent/explain")
    def post_explain(body: ExplainRequest, request: Request):
        snapshot, names = block_snapshot(body.block)
        if not allowed(request):
            return JSONResponse({"status": "limited", "message": LIMITED}, status_code=429)
        try:
            result = explain(snapshot, names, agent_model(), files, cache)
        except Unavailable:
            return JSONResponse({"status": "unavailable"}, status_code=503)
        except ModelError:
            return JSONResponse({"status": "busy"}, status_code=503)
        if result["status"] != "ok":
            return {"status": "unchecked"}
        return {key: result[key] for key in ("status", "answer", "key", "model", "cached")}

    @app.post("/api/agent/chat")
    def post_chat(body: ChatRequest, request: Request):
        snapshot, names = block_snapshot(body.block)
        context = {"snapshot": snapshot, "names": names}
        if not allowed(request):
            return StreamingResponse(iter([f"data: {json.dumps({'type': 'error', 'message': LIMITED})}\n\n"]), media_type="text/event-stream")

        def stream():
            for event in run_chat(agent_model(), files, data, context, body.messages):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        return StreamingResponse(stream(), media_type="text/event-stream")

    if (web_dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")

    return app
