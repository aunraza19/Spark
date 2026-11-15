import argparse

from spark_data.agent.explain import AnswerCache, explain
from spark_data.agent.files import AgentFiles, load_files
from spark_data.agent.model import GeminiModel, Model, ModelError, NoModel, Unavailable
from spark_data.agent.settings import load_settings
from spark_data.block_snapshots import BadBlock, snapshot_for
from spark_data.data import Data, load_data
from spark_data.paths import AGENT_CACHE_DIR, CLEAN_DIR, REFERENCE_DIR

# The pressure ranges the map shows by default and in full. They must match PRESSURE_VIEWS in web/src/scale.ts.
ZOOMED_PSI = 20
FULL_PSI = 80


def _number(text: str, view: str) -> float:
    try:
        return float(text)
    except ValueError:
        raise ValueError(f"{view}: {text!r} is not a number") from None


def parse_view(view: str) -> dict:
    """Names a view for the demo: map:lunar, map:custom:34:8.2, scenario:34:8.2, ranking:iss, experiment:PSI-25."""
    kind, *rest = view.split(":")
    if kind in ("map", "ranking") and len(rest) == 1 and rest[0] and rest[0] != "custom":
        spec: dict = {"kind": kind, "habitat": rest[0]}
    elif kind in ("map", "ranking") and len(rest) == 3 and rest[0] == "custom":
        spec = {"kind": kind, "habitat": "custom", "o2": _number(rest[1], view), "psi": _number(rest[2], view)}
    elif kind == "scenario" and len(rest) == 2:
        return {"kind": "scenario", "o2": _number(rest[0], view), "psi": _number(rest[1], view)}
    elif kind == "experiment" and len(rest) == 1 and rest[0]:
        return {"kind": "experiment", "experiment_id": rest[0]}
    else:
        raise ValueError(f"{view!r} is not a view name")
    if kind == "map":
        spec["shown_psi_max"] = FULL_PSI if spec.get("psi", 0) > ZOOMED_PSI else ZOOMED_PSI
    return spec


def fill_cache(data: Data, views: list[str], model: Model, files: AgentFiles, cache: AnswerCache) -> list[dict]:
    results = []
    for view in views:
        try:
            snapshot, names = snapshot_for(data, parse_view(view))
        except (ValueError, BadBlock) as error:
            results.append({"view": view, "status": "invalid", "reason": str(error)})
            continue
        try:
            outcome = explain(snapshot, names, model, files, cache)
        except Unavailable:
            results.append({"view": view, "status": "unavailable"})
        except ModelError:
            results.append({"view": view, "status": "busy"})
        else:
            results.append({"view": view, "status": outcome["status"], "cached": outcome.get("cached", False), "key": outcome["key"]})
    return results


# The views to have ready for the demo. 34 and 8.2 are the NASA test atmosphere in data/reference/report_conditions.json.
DEFAULT_VIEWS = [
    "map:lunar",
    "map:iss",
    "map:custom:34:8.2",
    "ranking:lunar",
    "ranking:iss",
    "ranking:custom:34:8.2",
    "scenario:34:8.2",
    "experiment:PSI-25",
    "experiment:PSI-159",
    "experiment:PSI-69",
    "experiment:PSI-20",
    "experiment:PSI-98",
]

_WORDS = {
    "unchecked": "unchecked (Spark agent could not give a checked explanation)",
    "busy": "busy (Spark agent is busy; try again in a minute)",
    "unavailable": "unavailable (Spark agent is not set up on this server)",
}


def _line(result: dict) -> str:
    if result["status"] == "ok":
        return "ok (cached)" if result["cached"] else "ok"
    if result["status"] == "invalid":
        return f"invalid: {result['reason']}"
    return _WORDS[result["status"]]


def main(argv=None, model=None, settings=None, cache_dir=None) -> int:
    parser = argparse.ArgumentParser(description="Fill the Spark agent answer cache for a list of views.")
    parser.add_argument("--views", nargs="+", default=DEFAULT_VIEWS, help="for example map:lunar experiment:PSI-25")
    parser.add_argument("--list", action="store_true", help="print the default views and stop")
    args = parser.parse_args(argv)
    if args.list:
        print("\n".join(DEFAULT_VIEWS))
        return 0
    settings = settings or load_settings()
    if model is None:
        model = GeminiModel(settings) if settings.configured() else NoModel(settings.model)
    data = load_data(CLEAN_DIR, REFERENCE_DIR)
    results = fill_cache(data, args.views, model, load_files(), AnswerCache(cache_dir or AGENT_CACHE_DIR))
    for result in results:
        print(f"{result['view']}: {_line(result)}")
    return 0 if all(r["status"] == "ok" for r in results) else 1
