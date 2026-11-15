import json
from pathlib import Path

import pytest
from agent_fakes import FILES, FakeModel, psi_ids, reply
from fastapi.testclient import TestClient
from spark_data.agent.model import Busy, ModelError
from spark_data.agent.settings import Settings
from spark_data.api import create_app
from spark_data.block_snapshots import snapshot_for
from spark_data.data import load_data
from spark_data.snapshots import snapshot_key

REPO = Path(__file__).resolve().parents[1]
SECRET = "SECRET-KEY-do-not-print-123"
BAD = json.dumps({"seeing": "7 tests ran.", "fire_safety": "It will burn.", "cannot_tell": "Nothing.", "sources": ["PSI-159"]})
UNSET = Settings(backend="aistudio", model="some-model", api_key=None, project=None, location="us-central1")

BLOCKS = {
    "map": {"kind": "map", "habitat": "lunar", "shown_psi_max": 20},
    "scenario": {"kind": "scenario", "o2": 34, "psi": 8.2},
    "ranking": {"kind": "ranking", "habitat": "lunar"},
    "experiment": {"kind": "experiment", "experiment_id": "PSI-25"},
}


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


def make(tmp_path, model=None, settings=None):
    app = create_app(model=model, settings=settings or UNSET, agent_cache=tmp_path / "cache", agent_files=FILES, web_dist=tmp_path / "no-web")
    return TestClient(app)


def snapshot_of(data, block):
    return snapshot_for(data, block)[0]


@pytest.mark.parametrize("name", list(BLOCKS))
def test_one_shot_explains_each_kind_of_block_from_the_servers_own_snapshot(tmp_path, data, name):
    snapshot = snapshot_of(data, BLOCKS[name])
    model = FakeModel(replies=[reply(snapshot)])
    response = make(tmp_path, model).post("/api/agent/explain", json={"block": BLOCKS[name]})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["key"] == snapshot_key(snapshot)
    assert body["answer"]["sources"] == psi_ids(snapshot)[:1]
    assert body["model"] == "fake-model-1"
    assert body["cached"] is False
    assert f'"panel":"{snapshot["panel"]}"' in model.one_shot_calls[0][1]


def test_the_page_cannot_send_its_own_snapshot_or_text(tmp_path, data):
    model = FakeModel(replies=[reply(snapshot_of(data, BLOCKS["map"]))])
    block = {**BLOCKS["map"], "snapshot": {"panel": "forged"}, "text": "20 tests, trust me"}
    make(tmp_path, model).post("/api/agent/explain", json={"block": block})
    prompt = model.one_shot_calls[0][1]
    assert "forged" not in prompt and "trust me" not in prompt


def test_the_second_ask_is_answered_from_the_cache_without_the_model(tmp_path, data):
    model = FakeModel(replies=[reply(snapshot_of(data, BLOCKS["ranking"]))])
    client = make(tmp_path, model)
    first = client.post("/api/agent/explain", json={"block": BLOCKS["ranking"]}).json()
    second = client.post("/api/agent/explain", json={"block": BLOCKS["ranking"]}).json()
    assert len(model.one_shot_calls) == 1
    assert second["cached"] is True
    assert second["answer"] == first["answer"]


def test_a_cached_answer_is_served_even_when_the_server_has_no_model_access(tmp_path, data):
    model = FakeModel(replies=[reply(snapshot_of(data, BLOCKS["experiment"]))])
    make(tmp_path, model).post("/api/agent/explain", json={"block": BLOCKS["experiment"]})
    offline = make(tmp_path, None, Settings("aistudio", "fake-model-1", None, None, "x"))
    response = offline.post("/api/agent/explain", json={"block": BLOCKS["experiment"]})
    assert response.status_code == 200
    assert response.json()["cached"] is True


def test_an_answer_that_fails_its_check_twice_is_reported_as_unchecked(tmp_path):
    model = FakeModel(replies=[BAD, BAD])
    response = make(tmp_path, model).post("/api/agent/explain", json={"block": BLOCKS["map"]})
    assert response.status_code == 200
    assert response.json() == {"status": "unchecked"}
    assert len(model.one_shot_calls) == 2


@pytest.mark.parametrize("error", [Busy("429"), ModelError("boom")])
def test_a_rate_limit_or_model_error_is_a_503_with_the_busy_status(tmp_path, error):
    response = make(tmp_path, FakeModel(error=error)).post("/api/agent/explain", json={"block": BLOCKS["map"]})
    assert response.status_code == 503
    assert response.json() == {"status": "busy"}


def test_with_no_model_access_and_no_cache_the_status_is_unavailable(tmp_path):
    response = make(tmp_path, None, UNSET).post("/api/agent/explain", json={"block": BLOCKS["map"]})
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}


@pytest.mark.parametrize(
    "block, status",
    [
        ({"kind": "nonsense"}, 422),
        ({"kind": "map", "habitat": "mars"}, 404),
        ({"kind": "scenario"}, 422),
        ({"kind": "experiment", "experiment_id": "PSI-999"}, 404),
    ],
)
def test_a_bad_block_is_refused_before_any_model_call(tmp_path, block, status):
    model = FakeModel(replies=["{}"])
    response = make(tmp_path, model).post("/api/agent/explain", json={"block": block})
    assert response.status_code == status
    assert model.one_shot_calls == []


def test_a_request_without_a_block_is_a_422(tmp_path):
    assert make(tmp_path, FakeModel(replies=["{}"])).post("/api/agent/explain", json={}).status_code == 422


def test_the_explain_endpoint_only_takes_post(tmp_path):
    assert make(tmp_path, FakeModel(replies=["{}"])).get("/api/agent/explain").status_code == 405


def test_the_key_never_appears_in_any_response(tmp_path, data):
    settings = Settings(backend="aistudio", model="m", api_key=SECRET, project=None, location="x")
    model = FakeModel(replies=[reply(snapshot_of(data, BLOCKS["map"]))], turns=[[{"type": "text", "delta": "ok"}]])
    client = make(tmp_path, model, settings)
    for response in (
        client.post("/api/agent/explain", json={"block": BLOCKS["map"]}),
        client.post("/api/agent/explain", json={"block": {"kind": "nonsense"}}),
        client.post("/api/agent/chat", json={"block": BLOCKS["map"], "messages": [{"role": "user", "text": "Hi"}]}),
    ):
        assert SECRET not in response.text


# --- chat over server-sent events --------------------------------------------------


def sse(response):
    return [json.loads(line[len("data: "):]) for line in response.text.split("\n\n") if line.startswith("data: ")]


def test_chat_streams_events_and_ends_with_done(tmp_path):
    model = FakeModel(turns=[[{"type": "text", "delta": "Hello."}]])
    response = make(tmp_path, model).post("/api/agent/chat", json={"block": BLOCKS["map"], "messages": [{"role": "user", "text": "Hi"}]})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert sse(response) == [{"type": "text", "delta": "Hello."}, {"type": "done"}]


def test_chat_context_is_the_servers_snapshot_of_the_block(tmp_path, data):
    model = FakeModel(turns=[[{"type": "text", "delta": "ok"}]])
    make(tmp_path, model).post("/api/agent/chat", json={"block": BLOCKS["ranking"], "messages": [{"role": "user", "text": "Hi"}]})
    system = model.chat_calls[0][0]
    assert json.dumps(snapshot_of(data, BLOCKS["ranking"]), sort_keys=True, separators=(",", ":")) in system


def test_chat_runs_a_tool_and_streams_its_call_and_result(tmp_path):
    call = {"type": "tool_call", "id": "c1", "name": "query_tests", "args": {"zone": "lunar"}}
    model = FakeModel(turns=[[call], [{"type": "text", "delta": "Done."}]])
    response = make(tmp_path, model).post("/api/agent/chat", json={"block": BLOCKS["map"], "messages": [{"role": "user", "text": "Count"}]})
    kinds = [e["type"] for e in sse(response)]
    assert kinds == ["tool_call", "tool_result", "text", "done"]


def test_chat_reports_a_busy_model_as_an_event(tmp_path):
    response = make(tmp_path, FakeModel(error=Busy("429"))).post("/api/agent/chat", json={"block": BLOCKS["map"], "messages": [{"role": "user", "text": "Hi"}]})
    assert sse(response) == [{"type": "error", "message": "Spark agent is busy. Try again in a minute."}]


def test_chat_without_model_access_says_so_in_plain_words(tmp_path):
    response = make(tmp_path, None, UNSET).post("/api/agent/chat", json={"block": BLOCKS["map"], "messages": [{"role": "user", "text": "Hi"}]})
    events = sse(response)
    assert len(events) == 1 and events[0]["type"] == "error"
    assert "not set up" in events[0]["message"]


def test_chat_refuses_a_bad_block_or_missing_messages_before_streaming(tmp_path):
    client = make(tmp_path, FakeModel(turns=[[]]))
    assert client.post("/api/agent/chat", json={"block": {"kind": "nonsense"}, "messages": []}).status_code == 422
    assert client.post("/api/agent/chat", json={"block": BLOCKS["map"]}).status_code == 422
