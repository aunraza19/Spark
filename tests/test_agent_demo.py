from pathlib import Path

import pytest
from agent_fakes import FILES, FakeModel, reply
from spark_data.agent.demo import DEFAULT_VIEWS, fill_cache, main, parse_view
from spark_data.agent.explain import AnswerCache
from spark_data.agent.model import Busy
from spark_data.agent.settings import Settings
from spark_data.block_snapshots import snapshot_for
from spark_data.data import load_data

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


@pytest.mark.parametrize(
    "view, spec",
    [
        ("map:lunar", {"kind": "map", "habitat": "lunar", "shown_psi_max": 20}),
        ("map:custom:34:8.2", {"kind": "map", "habitat": "custom", "o2": 34.0, "psi": 8.2, "shown_psi_max": 20}),
        ("scenario:34:8.2", {"kind": "scenario", "o2": 34.0, "psi": 8.2}),
        ("ranking:iss", {"kind": "ranking", "habitat": "iss"}),
        ("ranking:custom:28:9", {"kind": "ranking", "habitat": "custom", "o2": 28.0, "psi": 9.0}),
        ("experiment:PSI-25", {"kind": "experiment", "experiment_id": "PSI-25"}),
    ],
)
def test_a_view_name_is_a_block_description(view, spec):
    assert parse_view(view) == spec


@pytest.mark.parametrize("view", ["", "nonsense", "map", "map:custom:34", "scenario:a:b", "experiment"])
def test_a_badly_named_view_is_refused(view):
    with pytest.raises(ValueError):
        parse_view(view)


def test_fill_cache_asks_for_each_view_and_stores_the_answers(tmp_path, data):
    cache = AnswerCache(tmp_path)
    views = ["map:lunar", "ranking:lunar", "experiment:PSI-25"]
    model = FakeModel(replies=[reply(snapshot_for(data, parse_view(v))[0]) for v in views])
    results = fill_cache(data, views, model, FILES, cache)
    assert [r["view"] for r in results] == views
    assert all(r["status"] == "ok" and r["cached"] is False for r in results)
    assert len(list(tmp_path.glob("*.json"))) == 3


def test_a_second_fill_finds_everything_cached_and_asks_the_model_nothing(tmp_path, data):
    cache = AnswerCache(tmp_path)
    views = ["map:lunar", "experiment:PSI-25"]
    fill_cache(data, views, FakeModel(replies=[reply(snapshot_for(data, parse_view(v))[0]) for v in views]), FILES, cache)
    model = FakeModel(error=Busy("down"))
    results = fill_cache(data, views, model, FILES, cache)
    assert [r["cached"] for r in results] == [True, True]
    assert model.one_shot_calls == []


def test_a_bad_view_or_a_busy_model_is_reported_and_the_rest_go_on(tmp_path, data):
    cache = AnswerCache(tmp_path)
    good = reply(snapshot_for(data, parse_view("experiment:PSI-25"))[0])

    class Flaky(FakeModel):
        def one_shot(self, system, prompt):
            if '"panel":"map"' in prompt:
                raise Busy("429")
            return good

    results = fill_cache(data, ["nonsense", "map:lunar", "experiment:PSI-25", "experiment:PSI-999"], Flaky(), FILES, cache)
    assert [r["status"] for r in results] == ["invalid", "busy", "ok", "invalid"]
    assert "reason" in results[0]


# --- the command ---------------------------------------------------------------


def test_the_default_demo_views_are_all_valid_blocks(data):
    assert len(DEFAULT_VIEWS) >= 8
    for view in DEFAULT_VIEWS:
        snapshot_for(data, parse_view(view))


def test_the_command_fills_the_cache_and_prints_one_plain_line_per_view(tmp_path, data, capsys):
    views = ["map:lunar", "experiment:PSI-25"]
    model = FakeModel(replies=[reply(snapshot_for(data, parse_view(v))[0]) for v in views])
    code = main(["--views", *views], model=model, cache_dir=tmp_path)
    out = capsys.readouterr().out
    assert code == 0
    assert "map:lunar: ok" in out and "experiment:PSI-25: ok" in out
    assert len(list(tmp_path.glob("*.json"))) == 2


def test_the_command_says_cached_when_the_answer_was_already_there(tmp_path, data, capsys):
    views = ["experiment:PSI-25"]
    model = FakeModel(replies=[reply(snapshot_for(data, parse_view(views[0]))[0])])
    main(["--views", *views], model=model, cache_dir=tmp_path)
    capsys.readouterr()
    main(["--views", *views], model=FakeModel(error=Busy("down")), cache_dir=tmp_path)
    assert "experiment:PSI-25: ok (cached)" in capsys.readouterr().out


def test_the_command_exits_with_1_when_any_view_failed(tmp_path, capsys):
    code = main(["--views", "nonsense"], model=FakeModel(replies=["{}"]), cache_dir=tmp_path)
    assert code == 1
    assert "nonsense: invalid" in capsys.readouterr().out


def test_with_no_model_access_it_says_so_and_prints_no_credential(tmp_path, capsys):
    settings = Settings("aistudio", "m", None, None, "x")
    code = main(["--views", "map:lunar"], settings=settings, cache_dir=tmp_path)
    out = capsys.readouterr().out
    assert code == 1
    assert "not set up" in out


def test_the_command_lists_the_default_views_without_asking_the_model(capsys):
    assert main(["--list"]) == 0
    assert capsys.readouterr().out.split() == DEFAULT_VIEWS
