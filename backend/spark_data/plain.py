from collections import Counter

from spark_data.data import Data
from spark_data.models import Habitat
from spark_data.ranking import Condition, Gap, at_target, gap, nearest
from spark_data.reference import in_zone


def fmt(value: float) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


def _cap(text: str) -> str:
    return text[:1].upper() + text[1:]


def _count(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def _join_or(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " or " + items[-1]


def _join_and(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _amount(value: float) -> str:
    return fmt(value) if round(value, 2) else "under 0.01"


def _points(value: float) -> str:
    return f"{_amount(value)} point{'' if abs(value) == 1 else 's'}"


def _label(data: Data, psi_id: str) -> str:
    record = data.entries[psi_id]["record"]
    return f"{record['acronym'] or record['name']} ({psi_id})"


def _burned(data: Data, fuel_state: str | None, fuel: str | None) -> str:
    phrase = data.plain.fuel_states[fuel_state].singular if fuel_state in data.plain.fuel_states else "a burning sample"
    if not fuel:
        return phrase
    raw = fuel.strip()
    if raw[:1].isupper() and raw[1:].islower():
        raw = raw.lower()
    return f"{phrase}, {raw}"


def _result(data: Data, experiment_id: str, outcome: str | None) -> str:
    if outcome is None:
        return data.plain.no_outcome.words
    for known in data.plain.outcomes:
        if known.experiment_id == experiment_id and known.raw == outcome:
            return known.words
    return data.plain.unmapped.words.format(raw=outcome)


def _zone_gap_words(found: Gap) -> str:
    parts = []
    if found.o2_pct_points > 0:
        parts.append(f"{_points(found.o2_pct_points)} too little oxygen")
    if found.psi > 0:
        parts.append(f"{_amount(found.psi)} psi too much pressure")
    return " and ".join(parts)


def _signed_gap_words(found: Gap) -> str:
    parts = []
    if found.o2_pct_points:
        parts.append(f"{_points(abs(found.o2_pct_points))} {'less' if found.o2_pct_points < 0 else 'more'} oxygen")
    if found.psi:
        parts.append(f"{_amount(abs(found.psi))} psi {'less' if found.psi < 0 else 'more'} pressure")
    return " and ".join(parts)


def _point_for(data: Data, condition: Condition) -> dict | None:
    return next(
        (p for p in data.points if p["source_file"] == condition.source_file and p["source_row"] == condition.source_row),
        None,
    )


def _report_for(data: Data, condition: Condition):
    return next(
        (c for c in data.report_conditions if c.experiment_id == condition.experiment_id and c.test_id == condition.test_id),
        None,
    )


def _evidence_sentences(data: Data, condition: Condition, found: Gap, target: Habitat, lead: str) -> list[str]:
    label = _label(data, condition.experiment_id)
    subject = f"a NASA report on {label}" if condition.basis == "report" else label
    o2 = target.o2_pct + found.o2_pct_points
    psi = target.pressure_psi + found.psi
    sentences = [lead.format(subject=subject, o2=fmt(o2), psi=fmt(psi))]
    if condition.basis == "report":
        report = _report_for(data, condition)
        sentences.append(f"It burned {report.fuel}.")
        sentences.append(report.outcome_words)
    else:
        point = _point_for(data, condition)
        sentences.append(f"It was {_burned(data, point['fuel_state'], point['fuel'])}.")
        sentences.append(_result(data, point["experiment_id"], point["outcome"]))
    return sentences


def _without_conditions_line(data: Data) -> str:
    with_conditions = {c.experiment_id for c in data.conditions}
    missing = len([i for i in data.entries if i not in with_conditions])
    return f"{missing} of {len(data.entries)} experiments have no per-test conditions, so they are not on the map."


def _zone_summary(data: Data, zone: Habitat) -> dict:
    name = zone.short_name or zone.label
    inside = [c for c in data.conditions if in_zone(c.o2_min, c.psi_max, zone)]
    tests_inside = [c for c in inside if c.basis == "test"]
    reports_inside = [c for c in inside if c.basis == "report"]
    by_type = Counter(c.fuel_state for c in tests_inside)
    present = [t for t in data.plain.order if by_type[t]]
    absent = [t for t in data.plain.order if not by_type[t]]
    phrases = data.plain.fuel_states

    lead: list[str] = []
    n = len(tests_inside)
    if n == 0:
        lead.append(f"No test ran inside the {name}.")
    else:
        lead.append(f"{_count(n, 'test')} ran inside the {name}.")
        if len(present) == 1:
            kind = phrases[present[0]]
            lead.append(f"All of them were {kind.plural}." if n > 1 else f"It was {kind.singular}.")
        else:
            lead.append("They were " + _join_and([f"{by_type[t]} {phrases[t].plural}" for t in present]) + ".")
    if reports_inside:
        lead.append(f"A NASA report also describes {_count(len(reports_inside), 'test')} inside it.")
    if absent:
        lead.append(f"No {_join_or([phrases[t].absent for t in absent])} was tested here.")

    know = [f"{_cap(phrases[t].plural)}: {_count(by_type[t], 'test')} ran inside the {name}." for t in present]
    dont_know: list[str] = []
    outside = [c for c in data.conditions if c.basis == "test" and not in_zone(c.o2_min, c.psi_max, zone)]
    for t in absent:
        dont_know.append(f"{_cap(phrases[t].absent)}: no test ran inside the {name}.")
        own = [c for c in outside if c.fuel_state == t]
        if own:
            condition, found = nearest(own, zone, 1)[0]
            dont_know.append(f"The closest was {condition.experiment_id}: {_zone_gap_words(found)}.")
    dont_know.append(_without_conditions_line(data))
    return {"lead": lead, "know": know, "dont_know": dont_know}


def _point_summary(data: Data, habitat: Habitat) -> dict:
    target = "your target" if habitat.id == "custom" else f"the {habitat.label}"
    phrases = data.plain.fuel_states
    here_all = [c for c in data.conditions if at_target(gap(c, habitat))]
    lead: list[str] = []
    if here_all:
        lead.append(f"{_count(len(here_all), 'test')} ran at exactly this condition.")
        condition, found = nearest(here_all, habitat, 1)[0]
        lead += _evidence_sentences(data, condition, found, habitat, "One was {subject}.")
    else:
        lead.append("No test ran at exactly this condition.")
        condition, found = nearest(data.conditions, habitat, 1)[0]
        lead += _evidence_sentences(data, condition, found, habitat, "The closest evidence is {subject} at {o2} % oxygen and {psi} psi.")
        words = _signed_gap_words(found)
        if words:
            lead.append(f"It had {words} than {target}.")

    tests = [c for c in data.conditions if c.basis == "test"]
    know: list[str] = []
    dont_know: list[str] = []
    for t in data.plain.order:
        own = [c for c in tests if c.fuel_state == t]
        here = [c for c in own if at_target(gap(c, habitat))]
        if here:
            know.append(f"{_cap(phrases[t].plural)}: {_count(len(here), 'test')} ran at exactly this condition.")
            continue
        dont_know.append(f"{_cap(phrases[t].absent)}: no test ran at exactly this condition.")
        if own:
            condition, found = nearest(own, habitat, 1)[0]
            dont_know.append(f"The closest was {condition.experiment_id}: {_signed_gap_words(found)} than {target}.")
    dont_know.append(_without_conditions_line(data))
    return {"lead": lead, "know": know, "dont_know": dont_know}


def map_summary(data: Data, habitat: Habitat) -> dict:
    return _zone_summary(data, habitat) if habitat.kind == "zone" else _point_summary(data, habitat)


def _range_words(low: float, high: float, approximate: bool = False) -> str:
    text = fmt(low) if low == high else f"{fmt(low)} to {fmt(high)}"
    return f"about {text}" if approximate else text


def point_card(
    data: Data, source_file: str | None, source_row: int | None, experiment_id: str | None, test_id: str | None
) -> dict | None:
    if source_file is not None:
        point = next((p for p in data.points if p["source_file"] == source_file and p["source_row"] == source_row), None)
        if point is None:
            return None
        o2 = _range_words(point["o2_pct_min"], point["o2_pct_max"], point["o2_approximate"])
        psi = _range_words(point["pressure_psi_min"], point["pressure_psi_max"])
        from_record = point["pressure_basis"] == "record"
        return {
            "title": _label(data, point["experiment_id"]),
            "burned": _burned(data, point["fuel_state"], point["fuel"]),
            "conditions": f"{o2} % oxygen at {psi} psi",
            "result": _result(data, point["experiment_id"], point["outcome"]),
            "evidence": {
                "experiment_id": point["experiment_id"],
                "test_id": point["test_id"],
                "source_file": point["source_file"],
                "source_row": point["source_row"],
                "page": None,
                "figure": None,
                "pressure_note": "The pressure comes from the experiment record, not the test table." if from_record else None,
            },
        }
    report = next(
        (c for c in data.report_conditions if c.experiment_id == experiment_id and c.test_id == test_id), None
    )
    if report is None:
        return None
    return {
        "title": _label(data, report.experiment_id),
        "burned": report.fuel,
        "conditions": f"{_range_words(report.o2_pct_min, report.o2_pct_max)} % oxygen at "
        f"{_range_words(report.pressure_psi_min, report.pressure_psi_max)} psi",
        "result": report.outcome_words,
        "evidence": {
            "experiment_id": report.experiment_id,
            "test_id": report.test_id,
            "source_file": report.source.file,
            "source_row": None,
            "page": report.source.page,
            "figure": report.source.figure,
            "pressure_note": None,
        },
    }


_WHY = {"oxygen": "the oxygen value could not be read", "pressure": "the pressure value could not be read"}


def about(data: Data) -> dict:
    report = data.build_report
    problems: list[str] = []
    for table in report["tables"]:
        repeated = len(table["duplicates"])
        if repeated:
            problems.append(
                f"{table['experiment']}: {_count(repeated, 'repeated row')} "
                f"{'was' if repeated == 1 else 'were'} dropped. One copy of each was kept."
            )
    left_out: Counter = Counter()
    for table in report["tables"]:
        if table["points"] == 0:
            continue
        for reason, count in table["excluded_reasons"].items():
            left_out[(table["experiment"], _WHY[reason.split(":")[0]])] += count
    for (experiment, why), count in left_out.items():
        problems.append(f"{experiment}: {_count(count, 'row')} {'was' if count == 1 else 'were'} left out because {why}.")
    problems.append(f"{data.burner_count} burner-oxygen points are kept off the map.")
    problems.append(_without_conditions_line(data))
    problems += [f"{q.experiment}: {q.question}" for q in data.registry.open_questions]
    return {
        "data_version": data.data_version,
        "distance_rule": data.ranking.rules.distance_rule,
        "sources": [
            {"label": "Test points", "path": "data/clean/test_points.json", "count": len(data.points)},
            {
                "label": "Report conditions",
                "path": "data/reference/report_conditions.json",
                "count": len(data.report_conditions),
                "files": sorted({c.source.file for c in data.report_conditions}),
            },
            {"label": "Experiment records", "path": "data/clean/experiments.json", "count": len(data.entries)},
        ],
        "known_problems": problems,
    }
