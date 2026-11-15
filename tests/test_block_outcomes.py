from pathlib import Path

import pytest
from spark_data.agent.files import load_files
from spark_data.block_snapshots import names_for, snapshot_for
from spark_data.data import load_data
from spark_data.snapshots import build_map_snapshot

REPO = Path(__file__).resolve().parents[1]
FILES = load_files(REPO / "data" / "reference" / "agent")


@pytest.fixture(scope="module")
def data():
    return load_data(REPO / "data" / "clean", REPO / "data" / "reference")


def snapshot(data, spec):
    return snapshot_for(data, spec)[0]


LUNAR = {"kind": "map", "habitat": "lunar", "shown_psi_max": 20}
ISS = {"kind": "map", "habitat": "iss", "shown_psi_max": 20}
SCENARIO = {"kind": "scenario", "o2": 28, "psi": 9}
RANKING = {"kind": "ranking", "habitat": "lunar"}


def known_words(data):
    words = {o.words for o in data.plain.outcomes} | {data.plain.no_outcome.words}
    words |= {c.outcome_words for c in data.report_conditions}
    return words


def decimals(value):
    if isinstance(value, float):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from decimals(v)
    elif isinstance(value, list):
        for v in value:
            yield from decimals(v)


# --- the existing builders are not touched ----------------------------------------


def test_the_map_builder_alone_has_no_outcomes_but_the_agent_snapshot_adds_them(data):
    lunar = next(h for h in data.habitats if h.id == "lunar")
    assert "outcomes" not in build_map_snapshot(data, lunar, 20)
    assert "outcomes" in snapshot(data, LUNAR)


def test_the_agent_snapshot_keeps_everything_the_builder_made(data):
    lunar = next(h for h in data.habitats if h.id == "lunar")
    built = build_map_snapshot(data, lunar, 20)
    agent = snapshot(data, LUNAR)
    assert {k: v for k, v in agent.items() if k != "outcomes"} == built


def test_the_experiment_snapshot_has_no_outcomes_section(data):
    assert "outcomes" not in snapshot(data, {"kind": "experiment", "experiment_id": "PSI-25"})


# --- the lunar zone ----------------------------------------------------------------


def test_inside_the_zone_each_experiment_says_what_it_burned_and_what_its_tests_showed(data):
    inside = {e["experiment_id"]: e for e in snapshot(data, LUNAR)["outcomes"]["inside_zone"]}
    assert "PSI-159" in inside
    entry = inside["PSI-159"]
    assert entry["tests"] == snapshot(data, LUNAR)["view"]["inside_zone"]["by_experiment"]["PSI-159"]
    assert entry["burned"] == "a gas flame on a burner"
    assert sum(r["tests"] for r in entry["results"]) == entry["tests"]
    assert {r["result"] for r in entry["results"]} <= known_words(data)


def test_the_counts_inside_the_zone_match_the_map_snapshot(data):
    snap = snapshot(data, LUNAR)
    counted = {e["experiment_id"]: e["tests"] for e in snap["outcomes"]["inside_zone"]}
    assert counted == snap["view"]["inside_zone"]["by_experiment"]


def test_the_nasa_report_conditions_come_with_what_the_flame_did_and_where_it_is_written(data):
    conditions = snapshot(data, LUNAR)["outcomes"]["conditions"]
    inside = next(c for c in conditions if c["basis"] == "report" and c["o2_pct"] == 34 and c["pressure_psi"] == 8.2)
    assert inside["experiment_id"] == "PSI-20"
    assert inside["result"] == "The flame burned steadily."
    assert inside["source"] == "BRE_final_report_20220201.pdf, page 26, Figure 9"


def test_the_nearest_report_condition_outside_the_zone_says_it_went_out_after_a_time(data):
    report = next(c for c in data.report_conditions if c.o2_pct_min == 27 and c.pressure_psi_min == 10.2)
    conditions = snapshot(data, LUNAR)["outcomes"]["conditions"]
    entry = next(c for c in conditions if c["basis"] == "report" and c["o2_pct"] == 27 and c["pressure_psi"] == 10.2)
    assert entry["result"] == report.outcome_words
    assert "45 s" in entry["result"]
    assert entry["source"] == f"{report.source.file}, page {report.source.page}, {report.source.figure}"


def test_every_condition_has_a_plain_result_a_source_and_what_was_burned(data):
    for spec in (LUNAR, ISS, SCENARIO, RANKING):
        for entry in snapshot(data, spec)["outcomes"]["conditions"]:
            assert entry["result"] in known_words(data), entry
            assert entry["source"] and entry["burned"], entry
            assert entry["result"] not in {"SE", "FT", "-"}


def test_a_test_point_is_sourced_to_its_file_and_row(data):
    entries = snapshot(data, LUNAR)["outcomes"]["conditions"]
    test = next(c for c in entries if c["basis"] == "test")
    assert ", row " in test["source"]
    assert test["source"].split(", row ")[0].endswith(".csv")


# --- a point target ----------------------------------------------------------------


def test_a_point_map_has_no_inside_zone_section_and_lists_the_nearest_tests_with_results(data):
    snap = snapshot(data, ISS)
    assert "inside_zone" not in snap["outcomes"]
    nearest = snap["view"]["nearest_tests_by_experiment"]
    got = snap["outcomes"]["conditions"]
    assert [(c["experiment_id"], c["test_id"]) for c in got] == [(n["experiment_id"], n["test_id"]) for n in nearest]


def test_a_scenario_lists_each_nearest_test_in_the_same_order(data):
    snap = snapshot(data, SCENARIO)
    nearest = snap["view"]["nearest_tests"]
    got = snap["outcomes"]["conditions"]
    assert [(c["experiment_id"], c["test_id"], c["basis"]) for c in got] == [(n["experiment_id"], n["test_id"], n["basis"]) for n in nearest]
    assert got[0]["basis"] == "report" and "45 s" in got[0]["result"]


def test_the_gaps_to_the_nearest_tests_are_kept_for_a_point_target(data):
    for entry in snapshot(data, SCENARIO)["outcomes"]["conditions"]:
        assert "gap_o2_pct_points" in entry and "gap_psi" in entry


# --- the ranked list ---------------------------------------------------------------


def test_the_ranking_snapshot_gives_the_nearest_result_for_each_of_the_top_experiments(data):
    snap = snapshot(data, RANKING)
    top = [r["psi_id"] for r in snap["rows"][:3]]
    got = snap["outcomes"]["conditions"]
    assert [c["experiment_id"] for c in got] == top
    assert all(c["result"] in known_words(data) for c in got)


# --- numbers -----------------------------------------------------------------------


def test_the_enriched_snapshots_are_rounded_to_three_decimals(data):
    for spec in (LUNAR, ISS, SCENARIO, RANKING, {"kind": "map", "habitat": "custom", "o2": 28.123456, "psi": 9.987654}):
        for value in decimals(snapshot(data, spec)):
            assert value == round(value, 3)


# --- names and the words the model must not use ------------------------------------


def test_the_names_say_in_plain_words_what_each_experiment_burned(data):
    names = names_for(data, snapshot(data, RANKING))
    assert names["PSI-25"]["burned"] == "solid material"
    assert names["PSI-159"]["burned"] == "a gas flame on a burner"
    assert set(names["PSI-25"]) == {"title", "fuel_type", "burned"}


@pytest.mark.parametrize("word", ["loaded", "per-test conditions", "snapshot", "data version", "distance"])
def test_internal_words_are_on_the_banned_list(word):
    assert word in FILES.banned


@pytest.mark.parametrize(
    "needed",
    [
        "which kinds of material",
        "a point, not a zone",
        'never say "inside the target zone"',
        "the gaps",
        "what the nearest tests showed",
        "never say whether it is safe or unsafe",
        "what the top experiments burned",
        "no test table with oxygen and pressure",
        "plain words",
    ],
)
def test_the_prompt_carries_the_per_block_guidance(needed):
    assert needed in FILES.explain_prompt.lower()
