import json
from pathlib import Path

from agent_fakes import FILES, FakeModel, reply
from fastapi.testclient import TestClient
from spark_data.agent.limits import LIMITED, Limiter
from spark_data.agent.settings import Settings, load_settings
from spark_data.api import create_app
from spark_data.block_snapshots import snapshot_for
from spark_data.data import load_data

REPO = Path(__file__).resolve().parents[1]
MAP = {"kind": "map", "habitat": "lunar", "shown_psi_max": 20}
HOUR = 3600
DAY = 86400


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_the_message_is_the_one_the_reader_sees():
    assert LIMITED == "Spark agent has reached its limit for now. Try again later."


def test_a_visitor_gets_their_hourly_number_of_requests_and_then_is_refused():
    limiter = Limiter(per_hour=3, per_day=100, clock=Clock())
    assert [limiter.allow("1.1.1.1") for _ in range(4)] == [True, True, True, False]


def test_another_visitor_is_not_affected():
    limiter = Limiter(per_hour=1, per_day=100, clock=Clock())
    assert limiter.allow("1.1.1.1") and not limiter.allow("1.1.1.1")
    assert limiter.allow("2.2.2.2")


def test_a_visitor_can_ask_again_an_hour_later():
    clock = Clock()
    limiter = Limiter(per_hour=1, per_day=100, clock=clock)
    assert limiter.allow("1.1.1.1")
    clock.now += HOUR - 1
    assert not limiter.allow("1.1.1.1")
    clock.now += 2
    assert limiter.allow("1.1.1.1")


def test_the_daily_number_is_shared_by_everyone_and_resets_after_a_day():
    clock = Clock()
    limiter = Limiter(per_hour=100, per_day=3, clock=clock)
    assert [limiter.allow(ip) for ip in ("a", "b", "c", "d")] == [True, True, True, False]
    clock.now += DAY + 1
    assert limiter.allow("e")


def test_a_refused_request_does_not_use_up_the_daily_number():
    limiter = Limiter(per_hour=1, per_day=2, clock=Clock())
    assert limiter.allow("a")
    assert not limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.allow("b")


def test_the_limits_come_from_settings_with_20_an_hour_and_300_a_day_by_default():
    s = load_settings(env={}, dotenv=Path("none.env"))
    assert (s.limit_per_hour, s.limit_per_day) == (20, 300)
    s = load_settings(env={"SPARK_LIMIT_PER_HOUR": "5", "SPARK_LIMIT_PER_DAY": "50"}, dotenv=Path("none.env"))
    assert (s.limit_per_hour, s.limit_per_day) == (5, 50)


def make(tmp_path, per_hour=2, per_day=100, model=None):
    settings = Settings(backend="aistudio", model="m", api_key=None, project=None, location="global", limit_per_hour=per_hour, limit_per_day=per_day)
    data = load_data(REPO / "data" / "clean", REPO / "data" / "reference")
    snapshot = snapshot_for(data, MAP)[0]
    model = model or FakeModel(replies=[reply(snapshot)], turns=[[{"type": "text", "delta": "Hi."}]] * 10)
    app = create_app(model=model, settings=settings, agent_cache=tmp_path / "cache", agent_files=FILES, web_dist=tmp_path / "no-web")
    return TestClient(app), model


def explain(client, ip="9.9.9.9", fresh=0):
    """Each different `fresh` is a block that is not in the cache yet, so it needs the model."""
    block = {**MAP, "shown_psi_max": 20 + fresh}
    return client.post("/api/agent/explain", json={"block": block}, headers={"X-Forwarded-For": ip})


def chat(client, ip="9.9.9.9"):
    return client.post("/api/agent/chat", json={"block": MAP, "messages": [{"role": "user", "text": "Hi"}]}, headers={"X-Forwarded-For": ip})


def events(response):
    return [json.loads(line[6:]) for line in response.text.split("\n\n") if line.startswith("data: ")]


def test_explain_is_refused_with_the_message_once_the_visitor_is_over_the_hourly_limit(tmp_path):
    client, model = make(tmp_path, per_hour=2)
    assert explain(client, fresh=1).status_code == 200
    assert explain(client, fresh=2).status_code == 200
    refused = explain(client, fresh=3)
    assert refused.status_code == 429
    assert refused.json() == {"status": "limited", "message": LIMITED}
    assert len(model.one_shot_calls) == 2


def test_chat_says_it_as_an_error_event_and_never_calls_the_model(tmp_path):
    client, model = make(tmp_path, per_hour=1)
    assert events(chat(client))[-1] == {"type": "done"}
    refused = chat(client)
    assert events(refused) == [{"type": "error", "message": LIMITED}]
    assert len(model.chat_calls) == 1


def test_explain_and_chat_share_one_allowance(tmp_path):
    client, _ = make(tmp_path, per_hour=2)
    explain(client, fresh=1)
    chat(client)
    assert explain(client, fresh=2).status_code == 429
    assert events(chat(client)) == [{"type": "error", "message": LIMITED}]


def test_the_visitor_is_the_first_entry_of_x_forwarded_for(tmp_path):
    client, _ = make(tmp_path, per_hour=1)
    assert explain(client, ip="1.1.1.1, 10.0.0.1", fresh=1).status_code == 200
    assert explain(client, ip="1.1.1.1, 10.0.0.2", fresh=2).status_code == 429
    assert explain(client, ip="2.2.2.2, 10.0.0.1", fresh=3).status_code == 200


def test_the_daily_limit_stops_everyone(tmp_path):
    client, _ = make(tmp_path, per_hour=100, per_day=2)
    assert explain(client, ip="1.1.1.1", fresh=1).status_code == 200
    assert explain(client, ip="2.2.2.2", fresh=2).status_code == 200
    assert explain(client, ip="3.3.3.3", fresh=3).status_code == 429


def test_without_the_header_the_connection_address_is_used(tmp_path):
    client, _ = make(tmp_path, per_hour=1)
    first = client.post("/api/agent/explain", json={"block": {**MAP, "shown_psi_max": 21}})
    second = client.post("/api/agent/explain", json={"block": {**MAP, "shown_psi_max": 22}})
    assert (first.status_code, second.status_code) == (200, 429)


def test_pages_and_data_are_never_limited(tmp_path):
    client, _ = make(tmp_path, per_hour=1, per_day=1)
    explain(client)
    for _ in range(5):
        assert client.get("/api/habitats", headers={"X-Forwarded-For": "9.9.9.9"}).status_code == 200


def test_an_answer_that_is_already_cached_is_free_and_does_not_count(tmp_path):
    client, model = make(tmp_path, per_hour=1, per_day=1)
    assert explain(client, fresh=1).status_code == 200
    for _ in range(3):
        again = explain(client, fresh=1)
        assert again.status_code == 200 and again.json()["cached"] is True
    assert len(model.one_shot_calls) == 1


def test_a_cached_answer_is_served_even_when_the_visitor_is_over_the_limit(tmp_path):
    client, _ = make(tmp_path, per_hour=1)
    assert explain(client, fresh=1).status_code == 200
    assert explain(client, fresh=2).status_code == 429
    assert explain(client, fresh=1).status_code == 200
