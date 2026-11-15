import json
from pathlib import Path

import pytest
from agent_fakes import FILES, FakeModel, reply
from spark_data.agent.explain import AnswerCache, explain
from spark_data.agent.files import AgentFiles, load_files
from spark_data.agent.model import Busy, ModelError
from spark_data.snapshots import snapshot_key

SNAPSHOT = {"panel": "map", "view": {"inside_zone": {"test_points": 20, "by_experiment": {"PSI-159": 20}}}}
NAMES = {"PSI-159": {"title": "ACME CFI-G (PSI-159)"}}
BAD = json.dumps({"seeing": "7 tests ran.", "fire_safety": "It will burn.", "cannot_tell": "Nothing.", "sources": ["PSI-159"]})


@pytest.fixture
def cache(tmp_path):
    return AnswerCache(tmp_path / "cache")


def test_a_checked_answer_is_returned_with_its_key_and_model(cache):
    model = FakeModel(replies=[reply(SNAPSHOT)])
    result = explain(SNAPSHOT, NAMES, model, FILES, cache)
    assert result["status"] == "ok"
    assert result["answer"]["sources"] == ["PSI-159"]
    assert result["key"] == snapshot_key(SNAPSHOT)
    assert result["model"] == "fake-model-1"
    assert result["cached"] is False


def test_the_model_gets_the_prompt_file_the_banned_list_and_the_snapshot_not_screen_text(cache):
    model = FakeModel(replies=[reply(SNAPSHOT)])
    explain(SNAPSHOT, NAMES, model, FILES, cache)
    system, prompt = model.one_shot_calls[0]
    assert system.startswith("EXPLAIN SYSTEM")
    assert "will burn" in system and "is safe" in system
    assert json.dumps(SNAPSHOT, sort_keys=True, separators=(",", ":")) in prompt
    assert "ACME CFI-G (PSI-159)" in prompt


def test_the_same_block_gets_the_same_instant_answer_without_asking_the_model_again(cache):
    model = FakeModel(replies=[reply(SNAPSHOT)])
    first = explain(SNAPSHOT, NAMES, model, FILES, cache)
    second = explain(SNAPSHOT, NAMES, model, FILES, cache)
    assert len(model.one_shot_calls) == 1
    assert second["cached"] is True
    assert second["answer"] == first["answer"]


def test_the_cache_is_keyed_by_snapshot_prompt_version_and_model(cache):
    explain(SNAPSHOT, NAMES, FakeModel(replies=[reply(SNAPSHOT)]), FILES, cache)
    other_model = FakeModel(replies=[reply(SNAPSHOT)], model_id="another-model")
    explain(SNAPSHOT, NAMES, other_model, FILES, cache)
    assert len(other_model.one_shot_calls) == 1
    newer = AgentFiles(FILES.explain_prompt, FILES.chat_prompt, FILES.banned, "v-newer")
    third = FakeModel(replies=[reply(SNAPSHOT)])
    explain(SNAPSHOT, NAMES, third, newer, cache)
    assert len(third.one_shot_calls) == 1
    changed = {**SNAPSHOT, "view": {"inside_zone": {"test_points": 21, "by_experiment": {"PSI-159": 21}}}}
    fourth = FakeModel(replies=[reply(changed)])
    explain(changed, NAMES, fourth, FILES, cache)
    assert len(fourth.one_shot_calls) == 1


def test_a_failed_check_regenerates_once_with_the_reasons(cache):
    model = FakeModel(replies=[BAD, reply(SNAPSHOT)])
    result = explain(SNAPSHOT, NAMES, model, FILES, cache)
    assert result["status"] == "ok"
    assert len(model.one_shot_calls) == 2
    second_prompt = model.one_shot_calls[1][1]
    assert "7" in second_prompt and "will burn" in second_prompt
    assert json.dumps(SNAPSHOT, sort_keys=True, separators=(",", ":")) in second_prompt


def test_two_failed_checks_give_up_and_cache_nothing(cache):
    model = FakeModel(replies=[BAD, BAD])
    result = explain(SNAPSHOT, NAMES, model, FILES, cache)
    assert result["status"] == "unchecked"
    assert "answer" not in result
    assert len(model.one_shot_calls) == 2
    again = FakeModel(replies=[reply(SNAPSHOT)])
    assert explain(SNAPSHOT, NAMES, again, FILES, cache)["cached"] is False


def test_an_answer_that_is_not_json_counts_as_a_failed_check(cache):
    model = FakeModel(replies=["Here is my answer in plain text.", reply(SNAPSHOT)])
    assert explain(SNAPSHOT, NAMES, model, FILES, cache)["status"] == "ok"
    assert "JSON" in model.one_shot_calls[1][1]


def test_a_rate_limit_or_a_model_error_is_raised_for_the_caller_to_report(cache):
    with pytest.raises(Busy):
        explain(SNAPSHOT, NAMES, FakeModel(error=Busy("rate limit")), FILES, cache)
    with pytest.raises(ModelError):
        explain(SNAPSHOT, NAMES, FakeModel(error=ModelError("boom")), FILES, cache)


def test_a_cache_hit_needs_no_model_at_all(cache):
    explain(SNAPSHOT, NAMES, FakeModel(replies=[reply(SNAPSHOT)]), FILES, cache)
    result = explain(SNAPSHOT, NAMES, FakeModel(error=Busy("down")), FILES, cache)
    assert result["status"] == "ok"
    assert result["cached"] is True


def test_the_cache_files_hold_the_answer_and_never_a_credential(cache, tmp_path):
    explain(SNAPSHOT, NAMES, FakeModel(replies=[reply(SNAPSHOT)]), FILES, cache)
    files = list((tmp_path / "cache").glob("*.json"))
    assert len(files) == 1
    stored = json.loads(files[0].read_text(encoding="utf-8"))
    assert stored["answer"]["sources"] == ["PSI-159"]
    assert set(stored) == {"snapshot_key", "prompt_version", "model", "answer"}


def test_a_damaged_cache_file_is_a_miss_not_a_crash(cache, tmp_path):
    explain(SNAPSHOT, NAMES, FakeModel(replies=[reply(SNAPSHOT)]), FILES, cache)
    for path in (tmp_path / "cache").glob("*.json"):
        path.write_text("{ not json", encoding="utf-8")
    model = FakeModel(replies=[reply(SNAPSHOT)])
    assert explain(SNAPSHOT, NAMES, model, FILES, cache)["status"] == "ok"
    assert len(model.one_shot_calls) == 1


REAL = Path(__file__).resolve().parents[1] / "data" / "reference" / "agent"


def test_the_prompt_files_exist_and_carry_the_agent_rules():
    files = load_files(REAL)
    text = files.explain_prompt.lower()
    for needed in ("only", "snapshot", "20 words", "what you are seeing", "what it means for fire safety", "what the data cannot tell you", "sources"):
        assert needed in text, needed
    assert "burn" in text and "safe" in text
    chat = files.chat_prompt.lower()
    assert "query_tests" in chat and "get_experiment" in chat
    assert len(files.banned) > 5
    assert "will burn" in files.banned


def test_the_prompt_version_changes_when_a_prompt_or_the_banned_list_changes(tmp_path):
    for name in ("explain_prompt.txt", "chat_prompt.txt", "banned_words.txt"):
        (tmp_path / name).write_text((REAL / name).read_text(encoding="utf-8"), encoding="utf-8")
    first = load_files(tmp_path).version
    assert load_files(tmp_path).version == first
    (tmp_path / "banned_words.txt").write_text("extra phrase\n", encoding="utf-8")
    assert load_files(tmp_path).version != first
    (tmp_path / "explain_prompt.txt").write_text("changed", encoding="utf-8")
    assert load_files(tmp_path).version not in {first}
