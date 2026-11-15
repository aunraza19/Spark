import json
import math
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from spark_data.api import create_app
from spark_data.data import load_data
from spark_data.models import Habitat
from spark_data.plain import about, fmt, map_summary, point_card

REPO = Path(__file__).resolve().parents[1]
CLEAN = REPO / "data" / "clean"
REFERENCE = REPO / "data" / "reference"


@pytest.fixture(scope="module")
def data():
    return load_data(CLEAN, REFERENCE)


@pytest.fixture(scope="module")
def points():
    return json.loads((CLEAN / "test_points.json").read_text(encoding="utf-8"))


def habitat(data, name):
    return next(h for h in data.habitats if h.id == name)


def custom(o2, psi):
    return Habitat(id="custom", label="Custom", kind="point", o2_pct=o2, pressure_psi=psi, source="User input")


def sentences(lines):
    return [s for line in lines for s in re.split(r"(?<=[.!?])\s+", line) if s]


# --- number words ----------------------------------------------------------------


@pytest.mark.parametrize("value, text", [(10.332, "10.33"), (34.0, "34"), (0.1, "0.1"), (7.3481, "7.35"), (-1.2, "-1.2"), (1.0000001, "1")])
def test_numbers_are_rounded_for_display_only(value, text):
    assert fmt(value) == text


# --- the lunar zone --------------------------------------------------------------


def test_the_lunar_lead_says_what_ran_inside_and_what_did_not(data):
    lead = map_summary(data, habitat(data, "lunar"))["lead"]
    assert lead == [
        "20 tests ran inside the lunar zone.",
        "All of them were gas flames on a burner.",
        "A NASA report also describes 1 condition inside it.",
        "No solid material or liquid fuel was tested here.",
    ]


def test_the_lunar_know_line_names_the_fuel_type_that_has_tests(data):
    know = map_summary(data, habitat(data, "lunar"))["know"]
    assert know == ["Gas flames on a burner: 20 tests ran inside the lunar zone."]


def zone_gap_words(test):
    parts = []
    o2 = max(0.0, 30 - test["o2_pct_max"])
    psi = max(0.0, test["pressure_psi_min"] - 10.2)
    if o2 > 0:
        parts.append(f"{fmt(o2)} points too little oxygen")
    if psi > 0:
        parts.append(f"{fmt(psi)} psi too much pressure")
    return " and ".join(parts)


def closest_to_zone(points, fuel_state):
    def distance(p):
        return math.hypot(max(0.0, 30 - p["o2_pct_max"]) / 30, max(0.0, p["pressure_psi_min"] - 10.2) / 10.2)

    return min((p for p in points if p["fuel_state"] == fuel_state), key=distance)


def test_the_lunar_dont_know_lines_name_the_closest_test_for_each_missing_fuel_type(data, points):
    lines = map_summary(data, habitat(data, "lunar"))["dont_know"]
    solid, liquid = closest_to_zone(points, "solid"), closest_to_zone(points, "liquid")
    assert lines[:4] == [
        "Solid material: no test ran inside the lunar zone.",
        f"The closest was {solid['experiment_id']}: {zone_gap_words(solid)}.",
        "Liquid fuel: no test ran inside the lunar zone.",
        f"The closest was {liquid['experiment_id']}: {zone_gap_words(liquid)}.",
    ]
    assert solid["experiment_id"] in ("PSI-98", "PSI-99", "PSI-25")
    assert liquid["experiment_id"] == "PSI-69"


def test_the_last_dont_know_line_counts_the_experiments_with_no_conditions(data):
    lines = map_summary(data, habitat(data, "lunar"))["dont_know"]
    assert lines[-1] == "16 of 24 experiments have no per-test conditions, so they are not on the map."


# --- a point target --------------------------------------------------------------


def test_a_custom_target_with_no_test_gets_the_closest_evidence_in_short_sentences(data):
    lead = map_summary(data, custom(28.0, 9.0))["lead"]
    assert lead == [
        "No test ran at exactly this condition.",
        "The closest evidence is a NASA report on ACME/BRE (PSI-20) at 27 % oxygen and 10.2 psi.",
        "It burned ethylene/N2 on a porous burner.",
        "The flame went out by itself after 45 s.",
        "It had 1 point less oxygen and 1.2 psi more pressure than your target.",
    ]


def test_a_custom_target_lists_every_fuel_type_as_unknown_with_its_closest_test(data, points):
    summary = map_summary(data, custom(28.0, 9.0))
    assert summary["know"] == []
    assert summary["dont_know"][0] == "Solid material: no test ran at exactly this condition."
    gas = min(
        (p for p in points if p["fuel_state"] == "gas"),
        key=lambda p: math.hypot((p["o2_pct_min"] - 28) / 28, (p["pressure_psi_min"] - 9) / 9),
    )
    closest = next(line for line in summary["dont_know"] if line.startswith(f"The closest was {gas['experiment_id']}"))
    assert "than your target" in closest


def test_a_target_taken_from_a_report_condition_has_a_condition_from_a_nasa_report_at_it(data):
    lead = map_summary(data, custom(34.0, 8.2))["lead"]
    assert lead[0] == "1 condition from a NASA report matches this target exactly."


def test_the_iss_lead_counts_tests_at_its_point_to_two_decimals(data, points):
    def gap(value, low, high):
        return min(max(value, low), high) - value

    expected = sum(
        abs(gap(21, p["o2_pct_min"], p["o2_pct_max"])) < 0.005 and abs(gap(14.7, p["pressure_psi_min"], p["pressure_psi_max"])) < 0.005
        for p in points
    )
    lead = map_summary(data, habitat(data, "iss"))["lead"]
    if expected:
        assert lead[0] == f"{expected} test{'s' if expected != 1 else ''} ran at exactly this condition."
    else:
        assert lead[0] == "No test ran at exactly this condition."


# --- plain words rules -----------------------------------------------------------


@pytest.mark.parametrize("target", ["lunar", "iss", (28.0, 9.0), (34.0, 8.2), (21.0, 30.0)])
def test_every_sentence_is_under_20_words_and_free_of_jargon(data, target):
    h = habitat(data, target) if isinstance(target, str) else custom(*target)
    summary = map_summary(data, h)
    for sentence in sentences(summary["lead"] + summary["know"] + summary["dont_know"]):
        assert len(sentence.split()) < 20, sentence
        for banned in ("snapshot", "data version", "distance", "AI-powered"):
            assert banned not in sentence.lower(), sentence


def every_target(data):
    targets = {h.id: h for h in data.habitats}
    targets["iss as a custom point"] = custom(21.0, 14.7)
    for c in data.report_conditions:
        if c.preset_label:
            targets[c.preset_label] = custom(c.o2_pct_min, c.pressure_psi_min)
    return targets


def test_every_computed_sentence_for_every_habitat_and_preset_is_under_20_words(data):
    targets = every_target(data)
    assert {"lunar", "iss", "spacesuit", "NASA test atmosphere"} <= set(targets)
    for name, target in targets.items():
        summary = map_summary(data, target)
        for sentence in sentences(summary["lead"] + summary["know"] + summary["dont_know"]):
            assert len(sentence.split()) < 20, f"{name}: {sentence}"


def test_every_sentence_in_every_card_of_every_point_and_report_is_under_20_words(data, points):
    cards = [point_card(data, p["source_file"], p["source_row"], None, None) for p in points]
    cards += [point_card(data, None, None, c.experiment_id, c.test_id) for c in data.report_conditions]
    assert len(cards) == len(points) + len(data.report_conditions)
    for card in cards:
        for text in (card["title"], card["burned"], card["conditions"], card["result"], card["evidence"]["pressure_note"] or ""):
            for sentence in sentences([text]):
                assert len(sentence.split()) < 20, sentence


def test_the_plain_words_cover_every_result_in_the_points(data, points):
    known = {(o.experiment_id, o.raw) for o in data.plain.outcomes}
    used = {(p["experiment_id"], p["outcome"]) for p in points if p["outcome"] is not None}
    assert used <= known, used - known


def test_the_reference_files_carry_the_plain_words_the_screens_need(data):
    assert habitat(data, "lunar").short_name == "lunar zone"
    presets = [c for c in data.report_conditions if c.preset_label]
    assert [(c.preset_label, c.test_id, c.o2_pct_min, c.pressure_psi_min) for c in presets] == [
        ("NASA test atmosphere", "19070D1", 34, 8.2)
    ]
    assert {c.test_id: c.outcome_words for c in data.report_conditions} == {
        "19070K1": "The flame burned steadily.",
        "19070D1": "The flame burned steadily.",
        "19056F1": "The flame went out by itself after 45 s.",
    }
    for phrase in data.plain.fuel_states.values():
        assert phrase.source


# --- the point card --------------------------------------------------------------


def find(points, file_part, row):
    return next(p for p in points if file_part in p["source_file"] and p["source_row"] == row)


def test_a_card_for_a_droplet_test_says_what_burned_the_conditions_and_the_result(data, points):
    point = find(points, "PSI-69", 38)
    card = point_card(data, point["source_file"], 38, None, None)
    assert card["title"] == "FLEX (PSI-69)"
    fuel = point["fuel"].lower()
    assert card["burned"] == f"a burning fuel droplet, {fuel}"
    assert card["conditions"] == "34 % oxygen at 10.33 psi"
    words = {"Extinction": "The flame went out before the droplet was used up.",
             "Completion": "The droplet burned until it was used up.",
             "Disruption": "The test ended in a disruption. The record does not say what that means."}
    assert card["result"] == words[point["outcome"]]
    assert card["evidence"]["source_file"] == "PSI-69_Experimental table_FLEX.csv"
    assert card["evidence"]["source_row"] == 38
    assert card["evidence"]["pressure_note"] is None


def test_a_card_for_a_test_with_no_outcome_column_says_so(data, points):
    point = find(points, "PSI-25", 2)
    card = point_card(data, point["source_file"], 2, None, None)
    assert card["result"] == "The tables do not record how this test ended."
    assert card["burned"].startswith("a burning solid sample, ")
    assert card["evidence"]["pressure_note"] == "The pressure comes from the experiment record, not the test table."


def test_a_card_uses_the_experiments_own_codes_for_results(data, points):
    expected = {"SE": "The flame went out by itself.", "FT": "The flame burned until the fuel flow was stopped.",
                "-": "No result is recorded for this test."}
    seen = set()
    for p in points:
        if p["experiment_id"] == "PSI-159" and p["outcome"] in expected and p["outcome"] not in seen:
            seen.add(p["outcome"])
            assert point_card(data, p["source_file"], p["source_row"], None, None)["result"] == expected[p["outcome"]]
    assert seen == set(expected)


def test_a_card_for_a_range_says_about_and_gives_both_ends(data, points):
    s2 = next(p for p in points if p["experiment_id"] == "PSI-98" and p["test_id"] == "S2")
    card = point_card(data, s2["source_file"], s2["source_row"], None, None)
    assert card["conditions"] == "about 21.5 % oxygen at 14.47 to 14.54 psi"


def test_a_card_for_a_report_condition_names_the_pdf_page_and_figure(data):
    card = point_card(data, None, None, "PSI-20", "19056F1")
    assert card["title"] == "ACME/BRE (PSI-20)"
    assert card["burned"] == "ethylene/N2 on a porous burner"
    assert card["conditions"] == "27 % oxygen at 10.2 psi"
    assert card["result"] == "The flame went out by itself after 45 s."
    assert (card["evidence"]["source_file"], card["evidence"]["page"], card["evidence"]["figure"]) == (
        "BRE_final_report_20220201.pdf", 25, "Figure 6",
    )


def test_an_unknown_card_is_none(data):
    assert point_card(data, "nothing.csv", 1, None, None) is None
    assert point_card(data, None, None, "PSI-20", "nope") is None


def test_every_sentence_in_every_card_is_under_20_words(data, points):
    for p in points[::37]:
        card = point_card(data, p["source_file"], p["source_row"], None, None)
        for text in (card["burned"], card["conditions"], card["result"]):
            for sentence in sentences([text]):
                assert len(sentence.split()) < 20, sentence


# --- about the data --------------------------------------------------------------


def test_about_lists_sources_version_rule_and_known_problems(data):
    result = about(data)
    assert result["data_version"] == data.data_version
    assert result["distance_rule"] == data.ranking.rules.distance_rule
    counts = {s["label"]: s["count"] for s in result["sources"]}
    assert counts == {"Test points": 878, "Report conditions": 3, "Experiment records": 24}
    problems = result["known_problems"]
    assert "PSI-39: 8 repeated rows were dropped. One copy of each was kept." in problems
    assert "PSI-107: 34 repeated rows were dropped. One copy of each was kept." in problems
    assert "PSI-69: 1 row was left out because the pressure value could not be read." in problems
    assert "263 burner-oxygen points are kept off the map." in problems
    for question in data.registry.open_questions:
        assert f"{question.experiment}: {question.question}" in problems


# --- the endpoints ---------------------------------------------------------------


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


def test_the_map_endpoint_adds_the_plain_summary(client):
    body = client.get("/api/snapshot/map", params={"habitat": "lunar", "shown_psi_max": 20}).json()
    assert body["summary"]["lead"][0] == "20 tests ran inside the lunar zone."
    assert set(body["summary"]) == {"lead", "know", "dont_know"}


def test_the_map_endpoint_gives_a_custom_target_the_closest_evidence(client):
    body = client.get("/api/snapshot/map", params={"habitat": "custom", "o2": 28, "psi": 9, "shown_psi_max": 20}).json()
    assert body["summary"]["lead"][0] == "No test ran at exactly this condition."


def test_the_about_endpoint(client):
    body = client.get("/api/about").json()
    assert body["distance_rule"].startswith("Each gap is a share")
    assert len(body["known_problems"]) >= 6


def test_the_point_card_endpoint(client):
    card = client.get("/api/point-card", params={"experiment_id": "PSI-20", "test_id": "19056F1"}).json()
    assert card["title"] == "ACME/BRE (PSI-20)"
    points = client.get("/api/points").json()
    point = next(p for p in points if p["experiment_id"] == "PSI-69")
    card = client.get("/api/point-card", params={"source_file": point["source_file"], "source_row": point["source_row"]}).json()
    assert card["title"] == "FLEX (PSI-69)"


@pytest.mark.parametrize(
    "params, status",
    [({"experiment_id": "PSI-20", "test_id": "nope"}, 404), ({"source_file": "x.csv", "source_row": 3}, 404), ({}, 422),
     ({"source_file": "x.csv"}, 422), ({"experiment_id": "PSI-20"}, 422)],
)
def test_the_point_card_endpoint_rejects_unknown_and_incomplete_requests(client, params, status):
    assert client.get("/api/point-card", params=params).status_code == status
