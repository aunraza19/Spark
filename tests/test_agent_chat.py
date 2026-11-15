import json
from pathlib import Path

import pytest
from agent_fakes import FILES, FakeModel
from spark_data.agent.chat import TOOLS, run_chat, run_tool
from spark_data.agent.model import Busy
from spark_data.data import load_data

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


CONTEXT = {"snapshot": {"panel": "map", "view": {"inside_zone": {"test_points": 20}}}, "names": {}}


# --- the two tools -----------------------------------------------------------------


def test_there_are_two_tools_named_query_tests_and_get_experiment():
    assert {t["name"] for t in TOOLS} == {"query_tests", "get_experiment"}
    assert all(t["description"] and t["parameters_json_schema"]["type"] == "object" for t in TOOLS)


def test_query_tests_counts_the_lunar_zone_as_the_build_report_does(data):
    report = json.loads((REPO / "data" / "clean" / "build_report.json").read_text(encoding="utf-8"))
    result = run_tool(data, "query_tests", {"zone": "lunar"})
    assert result["count"] == report["lunar_zone"]["test_points"]
    assert sum(result["by_experiment"].values()) == result["count"]
    assert "test_points.json" in result["source"]


def test_query_tests_filters_by_experiment_and_fuel_state(data):
    only = run_tool(data, "query_tests", {"experiment_id": "PSI-25"})
    assert only["count"] == sum(p["experiment_id"] == "PSI-25" for p in data.points)
    assert set(only["by_experiment"]) == {"PSI-25"}
    gas = run_tool(data, "query_tests", {"fuel_state": "gas"})
    assert gas["count"] == sum(p["fuel_state"] == "gas" for p in data.points)


def test_query_tests_filters_by_oxygen_and_pressure_ranges(data):
    result = run_tool(data, "query_tests", {"o2_pct_min": 30, "pressure_psi_max": 10.2})
    expected = sum(p["o2_pct_min"] >= 30 and p["pressure_psi_max"] <= 10.2 for p in data.points)
    assert result["count"] == expected
    assert result["filter"] == {"o2_pct_min": 30, "pressure_psi_max": 10.2}


def test_query_tests_with_no_filter_counts_every_ambient_point(data):
    assert run_tool(data, "query_tests", {})["count"] == len(data.points)


def test_get_experiment_returns_the_page_facts_for_one_experiment(data):
    result = run_tool(data, "get_experiment", {"psi_id": "PSI-25"})
    assert result["title"] == "BASS-II (PSI-25)"
    assert result["lead"][0] == "It burned solid material."
    assert result["key_results"] == data.entries["PSI-25"]["record"]["key_results"]
    assert result["conditions"]["tests_on_map"] > 0


def test_an_unknown_experiment_or_tool_gives_an_error_result_not_a_crash(data):
    assert "error" in run_tool(data, "get_experiment", {"psi_id": "PSI-999"})
    assert "error" in run_tool(data, "launch_rocket", {})
    assert "error" in run_tool(data, "query_tests", {"zone": "mars"})
    assert "error" in run_tool(data, "query_tests", {"surprise": 1})


# --- the chat loop -----------------------------------------------------------------


def events(model, data, messages):
    return list(run_chat(model, FILES, data, CONTEXT, messages))


def test_a_plain_answer_streams_text_and_ends(data):
    model = FakeModel(turns=[[{"type": "text", "delta": "Hello "}, {"type": "text", "delta": "there."}]])
    out = events(model, data, [{"role": "user", "text": "Hi"}])
    assert [e["type"] for e in out] == ["text", "text", "done"]
    assert "".join(e["delta"] for e in out if e["type"] == "text") == "Hello there."


def test_the_model_gets_the_chat_prompt_the_context_snapshot_the_messages_and_both_tools(data):
    model = FakeModel(turns=[[{"type": "text", "delta": "ok"}]])
    messages = [{"role": "assistant", "text": "Here is the explanation.", "tool_calls": []}, {"role": "user", "text": "Why?"}]
    events(model, data, messages)
    system, sent, tools = model.chat_calls[0]
    assert system.startswith("CHAT SYSTEM")
    assert "will burn" in system
    assert json.dumps(CONTEXT["snapshot"], sort_keys=True, separators=(",", ":")) in system
    assert sent == [{"role": "user", "text": "Explain this block."}, *messages]
    assert {t["name"] for t in tools} == {"query_tests", "get_experiment"}


def test_a_tool_call_is_run_on_the_server_and_its_result_goes_back_to_the_model(data):
    call = {"type": "tool_call", "id": "c1", "name": "query_tests", "args": {"zone": "lunar"}}
    model = FakeModel(turns=[[call], [{"type": "text", "delta": "That many."}]])
    out = events(model, data, [{"role": "user", "text": "How many in the lunar zone?"}])
    assert [e["type"] for e in out] == ["tool_call", "tool_result", "text", "done"]
    result = json.loads(out[1]["result"])
    assert out[1]["id"] == "c1"
    assert result["count"] == run_tool(data, "query_tests", {"zone": "lunar"})["count"]
    second = model.chat_calls[1][1]
    assert second[-2]["role"] == "assistant" and second[-2]["tool_calls"][0]["name"] == "query_tests"
    assert second[-1] == {"role": "tool", "tool_call_id": "c1", "content": out[1]["result"]}


def test_a_failing_tool_gives_the_model_an_error_result_and_the_chat_goes_on(data):
    call = {"type": "tool_call", "id": "c1", "name": "get_experiment", "args": {"psi_id": "PSI-999"}}
    model = FakeModel(turns=[[call], [{"type": "text", "delta": "No such experiment."}]])
    out = events(model, data, [{"role": "user", "text": "Tell me about PSI-999"}])
    assert "error" in json.loads(out[1]["result"])
    assert out[-1]["type"] == "done"


def test_the_chat_stops_after_a_few_rounds_of_tool_calls(data):
    call = {"type": "tool_call", "id": "c", "name": "query_tests", "args": {}}
    model = FakeModel(turns=[[call]] * 10)
    out = events(model, data, [{"role": "user", "text": "Loop"}])
    assert len(model.chat_calls) <= 5
    assert out[-1]["type"] == "done"


def test_a_busy_model_becomes_one_error_event_with_a_plain_message(data):
    out = events(FakeModel(error=Busy("429")), data, [{"role": "user", "text": "Hi"}])
    assert out == [{"type": "error", "message": "Spark agent is busy. Try again in a minute."}]


def test_a_chat_that_opens_with_the_explanation_gets_a_user_turn_in_front_of_it(data):
    model = FakeModel(turns=[[{"type": "text", "delta": "ok"}]])
    messages = [{"role": "assistant", "text": "What you are seeing: ...", "tool_calls": []}, {"role": "user", "text": "Why?"}]
    events(model, data, messages)
    sent = model.chat_calls[0][1]
    assert sent[0] == {"role": "user", "text": "Explain this block."}
    assert sent[1]["role"] == "assistant" and sent[2]["role"] == "user"


def test_a_chat_that_already_opens_with_the_user_is_left_alone(data):
    model = FakeModel(turns=[[{"type": "text", "delta": "ok"}]])
    events(model, data, [{"role": "user", "text": "Hi"}])
    assert model.chat_calls[0][1] == [{"role": "user", "text": "Hi"}]
