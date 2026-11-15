import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from spark_data.api import create_app
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.pages import (
    conditions_words,
    experiment_list,
    experiment_page,
    ranking_view,
)
from spark_data.ranking import rank

REPO = Path(__file__).resolve().parents[1]
CLEAN = REPO / "data" / "clean"
REFERENCE = REPO / "data" / "reference"


@pytest.fixture(scope="module")
def data():
    return load_data(CLEAN, REFERENCE)


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


def habitat(data, name):
    return next(h for h in data.habitats if h.id == name)


def custom(o2, psi):
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")


def sentences(lines):
    return [s for line in lines for s in re.split(r"(?<=[.!?])\s+", line) if s]


def count_of(data, psi_id):
    return sum(c.experiment_id == psi_id for c in data.conditions)


# --- the list of all experiments ---------------------------------------------------


def test_the_list_has_every_experiment_in_id_order(data):
    rows = experiment_list(data)
    ids = [r["psi_id"] for r in rows]
    assert len(rows) == 24
    assert ids == sorted(data.entries, key=lambda i: int(i[4:]))


def test_each_row_has_the_plain_name_the_fuel_type_and_the_test_count(data):
    row = next(r for r in experiment_list(data) if r["psi_id"] == "PSI-25")
    assert row["name"] == data.entries["PSI-25"]["record"]["name"]
    assert row["fuel_type"] == "Solid material"
    assert row["kind"] == "flight"
    assert row["tests_with_conditions"] == count_of(data, "PSI-25")
    assert row["tests_text"] == f"{count_of(data, 'PSI-25')} tests"


def test_an_experiment_with_no_per_test_data_says_so(data):
    row = next(r for r in experiment_list(data) if r["psi_id"] == "PSI-21")
    assert row["tests_with_conditions"] == 0
    assert row["tests_text"] == "No per-test data"


def test_every_ground_study_says_no_per_test_data_and_is_marked_ground(data):
    grounds = [r for r in experiment_list(data) if r["kind"] == "ground"]
    assert len(grounds) == 5
    assert all(r["tests_text"] == "No per-test data" for r in grounds)


def test_the_fuel_type_uses_the_words_of_the_ranking_rules(data):
    labels = {c.label for c in data.ranking.rules.categories.values()}
    assert {r["fuel_type"] for r in experiment_list(data)} <= labels
    assert next(r for r in experiment_list(data) if r["psi_id"] == "PSI-47")["fuel_type"] == "No burning test"


# --- one experiment page -----------------------------------------------------------


def test_the_page_leads_with_what_was_burned_where_it_ran_and_how_many_tests_are_on_the_map(data):
    page = experiment_page(data, "PSI-25")
    n = count_of(data, "PSI-25")
    assert page["lead"] == [
        "It burned solid material.",
        "It ran on the ISS.",
        f"{n} tests have oxygen and pressure on the map.",
    ]


def test_a_cygnus_experiment_says_so(data):
    assert experiment_page(data, "PSI-98")["lead"][1] == "It ran in an uncrewed Cygnus cargo spacecraft, after it left the ISS."


def test_a_ground_study_says_it_has_no_test_table_of_its_own(data):
    lead = experiment_page(data, "PSI-60")["lead"]
    assert lead[1] == "It ran as a ground study, with a computer model or lab tests."
    assert lead[2] == "It has no test table of its own, so it is not on the map."


def test_a_flight_experiment_without_per_test_data_says_it_is_not_on_the_map(data):
    assert experiment_page(data, "PSI-21")["lead"][2] == "It has no per-test oxygen and pressure, so it is not on the map."


def test_the_key_results_are_the_record_as_it_is(data):
    page = experiment_page(data, "PSI-25")
    assert page["key_results"] == data.entries["PSI-25"]["record"]["key_results"]
    assert len(page["key_results"]) > 0


def test_the_evidence_carries_conditions_sensors_publications_and_data_quality_notes(data):
    record = data.entries["PSI-25"]["record"]
    evidence = experiment_page(data, "PSI-25")["evidence"]
    assert evidence["sensors"] == record["sensors"]
    assert evidence["data_quality_notes"] == record["data_quality_notes"]
    assert evidence["publications"] == [
        {k: p.get(k) for k in ("title", "authors", "doi", "link")} for p in record["publications"]
    ]
    assert evidence["fuels"] == record["fuel"]
    conditions = evidence["conditions"]
    assert conditions["tests_on_map"] == count_of(data, "PSI-25")
    assert conditions["record_note"] == record["conditions_note"]
    assert conditions["source_files"] == sorted({c.source_file for c in data.conditions if c.experiment_id == "PSI-25"})


def test_the_condition_ranges_come_from_the_tests_on_the_map(data):
    own = [c for c in data.conditions if c.experiment_id == "PSI-25"]
    ranges = experiment_page(data, "PSI-25")["evidence"]["conditions"]["ranges"]
    assert ranges["o2_pct"] == [min(c.o2_min for c in own), max(c.o2_max for c in own)]
    assert ranges["pressure_psi"] == [min(c.psi_min for c in own), max(c.psi_max for c in own)]


def test_an_experiment_with_no_tests_on_the_map_has_no_ranges(data):
    assert experiment_page(data, "PSI-21")["evidence"]["conditions"]["ranges"] is None


def test_the_evidence_names_its_source_files(data):
    evidence = experiment_page(data, "PSI-25")["evidence"]
    assert evidence["record_file"] == "data/incoming/experiments/psi-25.json"
    assert evidence["report_files"] == [r["file"] for r in data.entries["PSI-25"]["reports"]]


def test_an_unknown_experiment_has_no_page(data):
    assert experiment_page(data, "PSI-999") is None


def test_every_computed_sentence_on_every_experiment_page_is_plain_and_under_20_words(data):
    for psi_id in data.entries:
        page = experiment_page(data, psi_id)
        assert page is not None
        assert page["title"].endswith(f"({psi_id})")
        for sentence in sentences(page["lead"]):
            assert len(sentence.split()) < 20, sentence
            for banned in ("snapshot", "data version", "distance", "AI-powered"):
                assert banned not in sentence.lower(), sentence


def test_every_experiment_resolves_to_a_known_place(data):
    places = {w.words for w in data.plain.places.values()}
    for psi_id in data.entries:
        assert experiment_page(data, psi_id)["lead"][1] in {f"It ran {p}." for p in places}


# --- the ranked list ---------------------------------------------------------------


def test_the_ranking_follows_the_rank_order_and_numbers_the_rows(data):
    view = ranking_view(data, habitat(data, "lunar"))
    expected = rank(list(data.entries.values()), data.conditions, habitat(data, "lunar"), data.ranking)
    assert [r["psi_id"] for r in view["rows"]] == [r.psi_id for r in expected.rows]
    assert [r["rank"] for r in view["rows"]] == list(range(1, len(expected.rows) + 1))
    assert [n["psi_id"] for n in view["not_scored"]] == [n.psi_id for n in expected.not_scored]


def test_every_experiment_is_either_ranked_or_not_scored_with_a_reason(data):
    view = ranking_view(data, habitat(data, "lunar"))
    ids = [r["psi_id"] for r in view["rows"]] + [n["psi_id"] for n in view["not_scored"]]
    assert sorted(ids) == sorted(data.entries)
    assert all(n["reason"] for n in view["not_scored"])


def test_each_row_has_a_title_a_category_in_words_and_a_bar_value(data):
    row = ranking_view(data, habitat(data, "lunar"))["rows"][0]
    assert row["title"].endswith(f"({row['psi_id']})")
    assert row["category"] in {c.label for c in data.ranking.rules.categories.values()}
    assert 0 <= row["match"] <= 100


def test_the_numbers_for_each_row_are_kept_for_the_evidence(data):
    expected = rank(list(data.entries.values()), data.conditions, habitat(data, "lunar"), data.ranking)
    first = expected.rows[0]
    row = ranking_view(data, habitat(data, "lunar"))["rows"][0]
    assert row["match"] == round(first.atmosphere_match, 1)
    assert row["tests_inside_zone"] == first.tests_inside_zone
    assert row["tests_with_conditions"] == first.tests_with_conditions
    assert row["material_relevance"] == first.material_relevance


def test_the_lunar_lead_names_the_two_closest_experiments_and_says_no_solid_was_tested(data):
    view = ranking_view(data, habitat(data, "lunar"))
    a, b = (r["psi_id"] for r in view["rows"][:2])
    assert view["lead"] == [
        f"For the lunar zone, the closest evidence comes from {a} and {b}.",
        "Solid materials were not tested in this atmosphere.",
    ]


def test_the_iss_lead_says_solid_materials_were_tested_there(data):
    lead = ranking_view(data, habitat(data, "iss"))["lead"]
    assert lead[0].startswith("For the ISS cabin, the closest evidence comes from ")
    assert lead[1] == "Solid materials were tested in this atmosphere."


def test_a_custom_target_is_called_your_target(data):
    lead = ranking_view(data, custom(28.0, 9.0))["lead"]
    assert lead[0].startswith("For your target, the closest evidence comes from ")


def test_the_evidence_gives_the_rules_the_weights_and_our_weighting(data):
    evidence = ranking_view(data, habitat(data, "lunar"))["evidence"]
    rules = data.ranking.rules
    assert evidence["weighting_label"] == "our weighting"
    assert evidence["distance_rule"] == rules.distance_rule
    assert evidence["atmosphere_rule"] == rules.atmosphere_rule
    assert evidence["material_rule"] == rules.material_rule
    assert evidence["sort_rule"] == rules.sort_rule
    assert evidence["weights"] == {c.label: c.weight for c in rules.categories.values()}


@pytest.mark.parametrize("target", ["lunar", "iss", (28.0, 9.0), (34.0, 8.2), (21.0, 30.0)])
def test_every_ranking_sentence_is_plain_and_under_20_words(data, target):
    h = habitat(data, target) if isinstance(target, str) else custom(*target)
    for sentence in sentences(ranking_view(data, h)["lead"]):
        assert len(sentence.split()) < 20, sentence
        for banned in ("snapshot", "data version", "distance", "AI-powered"):
            assert banned not in sentence.lower(), sentence


# --- the web API -------------------------------------------------------------------


def test_the_api_serves_the_list_the_page_and_the_ranking(client):
    assert len(client.get("/api/experiment-list").json()) == 24
    page = client.get("/api/experiment-page/PSI-25")
    assert page.status_code == 200
    assert page.json()["psi_id"] == "PSI-25"
    ranking = client.get("/api/ranking", params={"habitat": "lunar"})
    assert ranking.status_code == 200
    assert ranking.json()["rows"][0]["rank"] == 1


def test_the_api_says_404_for_an_unknown_experiment_or_habitat(client):
    assert client.get("/api/experiment-page/PSI-999").status_code == 404
    assert client.get("/api/ranking", params={"habitat": "mars"}).status_code == 404


def test_the_api_ranks_a_custom_target_and_rejects_a_bad_one(client):
    assert client.get("/api/ranking", params={"habitat": "custom", "o2": 28, "psi": 9}).status_code == 200
    assert client.get("/api/ranking", params={"habitat": "custom", "o2": 0, "psi": 9}).status_code == 422
    assert client.get("/api/ranking", params={"habitat": "custom"}).status_code == 422


def test_the_pages_are_read_only(client):
    assert client.post("/api/ranking").status_code == 405
    assert client.delete("/api/experiment-page/PSI-25").status_code == 405


def test_the_plain_words_for_places_and_categories_each_carry_a_source(data):
    assert set(data.plain.places) == {"iss", "cygnus", "ground"}
    assert set(data.plain.categories) == set(data.ranking.rules.categories)
    for words in [*data.plain.places.values(), *data.plain.categories.values()]:
        assert words.words and words.source
    json.loads((REFERENCE / "plain_words.json").read_text(encoding="utf-8"))


# --- report conditions are not tests -----------------------------------------------


@pytest.mark.parametrize(
    "tests, reports, words",
    [
        (129, 0, "129 tests"),
        (1, 0, "1 test"),
        (0, 3, "3 conditions from a NASA report"),
        (0, 1, "1 condition from a NASA report"),
        (5, 2, "5 tests and 2 conditions from a NASA report"),
        (0, 0, "No per-test data"),
    ],
)
def test_the_words_for_tests_and_report_conditions_keep_them_apart(tests, reports, words):
    assert conditions_words(tests, reports) == words


def test_a_report_only_experiment_is_not_called_tests_in_the_list(data):
    row = next(r for r in experiment_list(data) if r["psi_id"] == "PSI-20")
    assert row["tests"] == 0
    assert row["report_conditions"] == 3
    assert row["tests_text"] == "3 conditions from a NASA report"


def test_the_list_counts_tests_and_report_conditions_separately_for_every_experiment(data):
    for row in experiment_list(data):
        assert row["tests"] + row["report_conditions"] == row["tests_with_conditions"]


def test_a_report_only_experiment_page_says_conditions_from_a_nasa_report(data):
    page = experiment_page(data, "PSI-20")
    assert page["lead"][2] == "3 conditions from a NASA report are on the map."
    conditions = page["evidence"]["conditions"]
    assert conditions["tests_on_map"] == 0
    assert conditions["report_conditions_on_map"] == 3


def test_an_experiment_with_tests_only_keeps_its_sentence(data):
    n = count_of(data, "PSI-25")
    assert experiment_page(data, "PSI-25")["lead"][2] == f"{n} tests have oxygen and pressure on the map."
    assert experiment_page(data, "PSI-25")["evidence"]["conditions"]["report_conditions_on_map"] == 0
