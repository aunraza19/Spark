import json
from collections.abc import Iterator

from spark_data.agent.explain import canonical
from spark_data.agent.files import AgentFiles
from spark_data.agent.model import Busy, Model, ModelError, Unavailable
from spark_data.data import Data
from spark_data.pages import experiment_page
from spark_data.reference import in_zone

MAX_ROUNDS = 5
BUSY = "Spark agent is busy. Try again in a minute."
NOT_SET_UP = "Spark agent is not set up on this server."

_FILTERS = ("experiment_id", "zone", "fuel_state", "o2_pct_min", "o2_pct_max", "pressure_psi_min", "pressure_psi_max")

TOOLS: list[dict] = [
    {
        "name": "query_tests",
        "description": (
            "Count ambient test points in data/clean/test_points.json. Report conditions from NASA reports are not tests "
            "and are not counted. All filters are optional and combine."
        ),
        "parameters_json_schema": {
            "type": "object",
            "properties": {
                "experiment_id": {"type": "string", "description": "For example PSI-159."},
                "zone": {"type": "string", "enum": ["lunar"], "description": "Only tests inside the lunar zone."},
                "fuel_state": {"type": "string", "enum": ["gas", "liquid", "solid"]},
                "o2_pct_min": {"type": "number", "description": "Only tests whose lowest oxygen is at least this, in percent."},
                "o2_pct_max": {"type": "number", "description": "Only tests whose highest oxygen is at most this, in percent."},
                "pressure_psi_min": {"type": "number", "description": "Only tests whose lowest pressure is at least this, in psi."},
                "pressure_psi_max": {"type": "number", "description": "Only tests whose highest pressure is at most this, in psi."},
            },
        },
    },
    {
        "name": "get_experiment",
        "description": "Read the facts about one experiment: its plain sentences, key results from the record and its conditions.",
        "parameters_json_schema": {
            "type": "object",
            "properties": {"psi_id": {"type": "string", "description": "For example PSI-25."}},
            "required": ["psi_id"],
        },
    },
]


def _query_tests(data: Data, args: dict) -> dict:
    unknown = sorted(set(args) - set(_FILTERS))
    if unknown:
        return {"error": f"unknown filter: {', '.join(unknown)}"}
    if args.get("zone") not in (None, "lunar"):
        return {"error": "zone can only be lunar"}
    if args.get("fuel_state") not in (None, "gas", "liquid", "solid"):
        return {"error": "fuel_state must be gas, liquid or solid"}
    points = data.points
    if "experiment_id" in args:
        points = [p for p in points if p["experiment_id"] == args["experiment_id"]]
    if args.get("zone") == "lunar":
        lunar = next(h for h in data.habitats if h.id == "lunar")
        points = [p for p in points if in_zone(p["o2_pct_min"], p["pressure_psi_max"], lunar)]
    if "fuel_state" in args:
        points = [p for p in points if p["fuel_state"] == args["fuel_state"]]
    for name, field, keep in (
        ("o2_pct_min", "o2_pct_min", lambda value, limit: value >= limit),
        ("o2_pct_max", "o2_pct_max", lambda value, limit: value <= limit),
        ("pressure_psi_min", "pressure_psi_min", lambda value, limit: value >= limit),
        ("pressure_psi_max", "pressure_psi_max", lambda value, limit: value <= limit),
    ):
        if name in args:
            points = [p for p in points if keep(p[field], args[name])]
    by_experiment: dict[str, int] = {}
    for p in points:
        by_experiment[p["experiment_id"]] = by_experiment.get(p["experiment_id"], 0) + 1
    return {
        "filter": {name: args[name] for name in _FILTERS if name in args},
        "count": len(points),
        "by_experiment": by_experiment,
        "source": "data/clean/test_points.json (ambient test points only; burner points and report conditions are not counted)",
    }


def run_tool(data: Data, name: str, args: dict) -> dict:
    if name == "query_tests":
        return _query_tests(data, args)
    if name == "get_experiment":
        page = experiment_page(data, str(args.get("psi_id", "")))
        if page is None:
            return {"error": "unknown experiment"}
        evidence = page["evidence"]
        return {
            "title": page["title"],
            "lead": page["lead"],
            "key_results": page["key_results"],
            "conditions": evidence["conditions"],
            "fuels": evidence["fuels"],
            "sensors": evidence["sensors"],
            "data_quality_notes": evidence["data_quality_notes"],
        }
    return {"error": f"unknown tool: {name}"}


def run_chat(model: Model, files: AgentFiles, data: Data, context: dict, messages: list[dict]) -> Iterator[dict]:
    system = (
        f"{files.instructions(files.chat_prompt)}\n\nSnapshot of the block the reader is looking at:\n{canonical(context['snapshot'])}"
        f"\n\nExperiment names:\n{canonical(context['names'])}"
    )
    sent = list(messages)
    try:
        for _ in range(MAX_ROUNDS):
            text = ""
            calls: list[dict] = []
            for event in model.chat_turn(system, sent, TOOLS):
                if event["type"] == "text":
                    text += event["delta"]
                    yield event
                elif event["type"] == "tool_call":
                    calls.append(event)
                    yield event
            if not calls:
                break
            sent.append(
                {"role": "assistant", "text": text, "tool_calls": [{"id": c["id"], "name": c["name"], "args": c["args"]} for c in calls]}
            )
            for call in calls:
                result = json.dumps(run_tool(data, call["name"], call["args"]), ensure_ascii=False)
                yield {"type": "tool_result", "id": call["id"], "name": call["name"], "result": result}
                sent.append({"role": "tool", "tool_call_id": call["id"], "content": result})
    except Unavailable:
        yield {"type": "error", "message": NOT_SET_UP}
        return
    except (Busy, ModelError):
        yield {"type": "error", "message": BUSY}
        return
    yield {"type": "done"}
