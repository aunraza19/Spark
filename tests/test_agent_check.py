import copy

import pytest
from spark_data.agent.check import check_answer

SNAPSHOT = {
    "habitat": {"id": "lunar", "o2_pct_min": 30, "pressure_psi_max": 10.2},
    "view": {"inside_zone": {"test_points": 20, "by_experiment": {"PSI-159": 20}}, "nearest": [{"experiment_id": "PSI-98", "gap": 8.3}]},
    "note": "Test 2-9 ran at 13.5 % O2.",
}
BANNED = ["will burn", "is safe"]

GOOD = {
    "seeing": "20 tests ran inside the lunar zone at 30 % oxygen or more.",
    "fire_safety": "PSI-159 shows gas flames at 10.2 psi or less.",
    "cannot_tell": "The data cannot show how a solid would behave.",
    "sources": ["PSI-159", "PSI-98"],
}


def with_(**changes):
    answer = copy.deepcopy(GOOD)
    answer.update(changes)
    return answer


def test_a_good_answer_has_no_problems():
    assert check_answer(GOOD, SNAPSHOT, BANNED) == []


def test_a_number_that_is_not_in_the_snapshot_is_rejected_and_named():
    reasons = check_answer(with_(seeing="7 tests ran inside the lunar zone."), SNAPSHOT, BANNED)
    assert len(reasons) == 1
    assert "7" in reasons[0]


def test_every_number_in_every_part_is_checked():
    reasons = check_answer(with_(cannot_tell="It had 99 psi.", fire_safety="Then 55 more."), SNAPSHOT, BANNED)
    assert any("99" in r for r in reasons)
    assert any("55" in r for r in reasons)


def test_decimals_and_percent_signs_are_read_as_numbers():
    assert check_answer(with_(seeing="13.5% of oxygen, and 8.3 points."), SNAPSHOT, BANNED) == []
    assert check_answer(with_(seeing="13.6% of oxygen."), SNAPSHOT, BANNED) != []


def test_a_trailing_zero_is_the_same_number():
    assert check_answer(with_(seeing="30.0 % oxygen and 10.20 psi."), SNAPSHOT, BANNED) == []


def test_digits_inside_psi_ids_and_test_ids_are_not_numbers():
    snapshot = copy.deepcopy(SNAPSHOT)
    snapshot["note"] = "Test 21088A1 and PSI-159."
    answer = with_(seeing="Test 21088A1 belongs to PSI-159.")
    assert check_answer(answer, snapshot, BANNED) == []


def test_numbers_in_the_snapshot_text_count_as_in_the_snapshot():
    assert check_answer(with_(seeing="Test 2-9 ran."), SNAPSHOT, BANNED) == []


def test_a_source_that_is_not_in_the_snapshot_is_rejected():
    reasons = check_answer(with_(sources=["PSI-159", "PSI-999"]), SNAPSHOT, BANNED)
    assert any("PSI-999" in r for r in reasons)


def test_a_psi_id_in_the_text_that_is_not_in_the_snapshot_is_rejected():
    reasons = check_answer(with_(fire_safety="PSI-888 is relevant."), SNAPSHOT, BANNED)
    assert any("PSI-888" in r for r in reasons)


def test_a_source_must_look_like_a_psi_id():
    assert check_answer(with_(sources=["159"]), SNAPSHOT, BANNED) != []


def test_at_least_one_source_is_needed_when_the_snapshot_has_ids():
    assert check_answer(with_(sources=[]), SNAPSHOT, BANNED) != []


def test_no_source_is_needed_when_the_snapshot_has_no_ids():
    answer = with_(seeing="Nothing here.", fire_safety="Nothing.", cannot_tell="Nothing.", sources=[])
    assert check_answer(answer, {"habitat": {"id": "lunar"}}, BANNED) == []


def test_a_sentence_of_20_words_or_more_is_rejected():
    long = " ".join(["word"] * 20) + "."
    reasons = check_answer(with_(seeing=long), SNAPSHOT, BANNED)
    assert any("20 words" in r for r in reasons)
    assert check_answer(with_(seeing=" ".join(["word"] * 19) + "."), SNAPSHOT, BANNED) == []


def test_sentences_are_counted_one_by_one():
    two = " ".join(["word"] * 15) + ". " + " ".join(["word"] * 15) + "."
    assert check_answer(with_(seeing=two), SNAPSHOT, BANNED) == []


@pytest.mark.parametrize("text", ["It will burn here.", "This atmosphere is safe.", "IT WILL BURN."])
def test_a_banned_phrase_is_rejected_whatever_its_case(text):
    reasons = check_answer(with_(fire_safety=text), SNAPSHOT, BANNED)
    assert any("will burn" in r or "is safe" in r for r in reasons)


def test_fire_safety_on_its_own_is_not_banned():
    assert check_answer(with_(fire_safety="This matters for fire safety."), SNAPSHOT, BANNED) == []


def test_a_banned_phrase_inside_a_longer_word_is_not_a_match():
    assert check_answer(with_(fire_safety="The wish is safely kept."), SNAPSHOT, ["is safe"]) == []


@pytest.mark.parametrize("field", ["seeing", "fire_safety", "cannot_tell"])
def test_every_part_must_be_a_non_empty_text(field):
    assert check_answer(with_(**{field: "  "}), SNAPSHOT, BANNED) != []
    answer = copy.deepcopy(GOOD)
    del answer[field]
    assert check_answer(answer, SNAPSHOT, BANNED) != []


def test_the_answer_must_be_an_object_with_a_list_of_sources():
    assert check_answer(with_(sources="PSI-159"), SNAPSHOT, BANNED) != []
    assert check_answer(["not", "an", "object"], SNAPSHOT, BANNED) != []


def test_more_than_six_sources_are_rejected_because_a_list_of_every_id_helps_nobody():
    ids = [f"PSI-{n}" for n in range(1, 9)]
    snapshot = {"ids": " ".join(ids)}
    answer = {"seeing": "A.", "fire_safety": "B.", "cannot_tell": "C.", "sources": ids}
    reasons = check_answer(answer, snapshot, BANNED)
    assert any("at most six" in r for r in reasons)
    assert check_answer({**answer, "sources": ids[:6]}, snapshot, BANNED) == []
