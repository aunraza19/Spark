
from spark_data.data import Data
from spark_data.models import Habitat
from spark_data.plain import _count, _label
from spark_data.ranking import at_target, gap, rank
from spark_data.reference import in_zone


def _number(psi_id: str) -> int:
    return int(psi_id[4:])


def _category(data: Data, psi_id: str) -> str:
    return next(f.category for f in data.ranking.fuel_categories if f.psi_id == psi_id)


def _category_label(data: Data, psi_id: str) -> str:
    return data.ranking.rules.categories[_category(data, psi_id)].label


def _place_key(entry: dict) -> str | None:
    platform = entry["record"]["flight_platform"] or ""
    if entry["kind"] == "ground":
        return "ground"
    if "Cygnus" in platform:
        return "cygnus"
    if "International Space Station" in platform or "ISS" in platform:
        return "iss"
    return None


def conditions_words(tests: int, reports: int) -> str:
    parts = []
    if tests:
        parts.append(_count(tests, "test"))
    if reports:
        parts.append(f"{_count(reports, 'condition')} from a NASA report")
    return " and ".join(parts) or "No per-test data"


def _counts(data: Data, psi_id: str) -> tuple[int, int]:
    own = [c for c in data.conditions if c.experiment_id == psi_id]
    return sum(c.basis == "test" for c in own), sum(c.basis == "report" for c in own)


def experiment_list(data: Data) -> list[dict]:
    rows = []
    for psi_id in sorted(data.entries, key=_number):
        tests, reports = _counts(data, psi_id)
        rows.append(
            {
                "psi_id": psi_id,
                "name": data.entries[psi_id]["record"]["name"],
                "kind": data.entries[psi_id]["kind"],
                "fuel_type": _category_label(data, psi_id),
                "tests": tests,
                "report_conditions": reports,
                "tests_with_conditions": tests + reports,
                "tests_text": conditions_words(tests, reports),
            }
        )
    return rows


def _lead(data: Data, entry: dict, tests: int, reports: int) -> list[str]:
    psi_id = entry["psi_id"]
    place = _place_key(entry)
    where = f"It ran {data.plain.places[place].words}." if place else "Where it ran is not reported."
    if tests and not reports:
        on_map = f"{conditions_words(tests, 0)} {'has' if tests == 1 else 'have'} oxygen and pressure on the map."
    elif tests or reports:
        on_map = f"{conditions_words(tests, reports)} {'is' if tests + reports == 1 else 'are'} on the map."
    elif entry["kind"] == "ground":
        on_map = "It has no test table of its own, so it is not on the map."
    else:
        on_map = "It has no per-test oxygen and pressure, so it is not on the map."
    return [f"It burned {data.plain.categories[_category(data, psi_id)].words}.", where, on_map]


def experiment_page(data: Data, psi_id: str) -> dict | None:
    entry = data.entries.get(psi_id)
    if entry is None:
        return None
    record = entry["record"]
    own = [c for c in data.conditions if c.experiment_id == psi_id]
    tests, reports = _counts(data, psi_id)
    ranges = (
        {
            "o2_pct": [min(c.o2_min for c in own), max(c.o2_max for c in own)],
            "pressure_psi": [min(c.psi_min for c in own), max(c.psi_max for c in own)],
        }
        if own
        else None
    )
    return {
        "psi_id": psi_id,
        "title": _label(data, psi_id),
        "name": record["name"],
        "acronym": record["acronym"],
        "kind": entry["kind"],
        "lead": _lead(data, entry, tests, reports),
        "key_results": record["key_results"],
        "evidence": {
            "conditions": {
                "tests_on_map": tests,
                "report_conditions_on_map": reports,
                "ranges": ranges,
                "source_files": sorted({c.source_file for c in own}),
                "record_note": record["conditions_note"],
            },
            "fuels": record["fuel"],
            "sensors": record["sensors"],
            "publications": [{k: p.get(k) for k in ("title", "authors", "doi", "link")} for p in record["publications"]],
            "data_quality_notes": record["data_quality_notes"],
            "record_file": f"data/incoming/experiments/{psi_id.lower()}.json",
            "report_files": [r["file"] for r in entry["reports"]],
        },
    }


def _target_name(target: Habitat) -> str:
    if target.id == "custom":
        return "your target"
    return f"the {target.short_name or target.label}"


def _solids_tested(data: Data, target: Habitat) -> bool:
    return any(
        _category(data, c.experiment_id) == "solid"
        and (in_zone(c.o2_min, c.psi_max, target) if target.kind == "zone" else at_target(gap(c, target)))
        for c in data.conditions
    )


def ranking_view(data: Data, target: Habitat) -> dict:
    ranking = rank(list(data.entries.values()), data.conditions, target, data.ranking)
    rows = [
        {
            "rank": position,
            "psi_id": r.psi_id,
            "title": _label(data, r.psi_id),
            "category": data.ranking.rules.categories[r.category].label,
            "match": round(r.atmosphere_match, 1),
            "tests_inside_zone": r.tests_inside_zone,
            "tests_with_conditions": r.tests_with_conditions,
            "material_relevance": r.material_relevance,
        }
        for position, r in enumerate(ranking.rows, start=1)
    ]
    closest = " and ".join(r["psi_id"] for r in rows[:2])
    lead = [f"For {_target_name(target)}, the closest evidence comes from {closest}." if closest else "No experiment has tests with oxygen and pressure."]
    lead.append(f"Solid materials were {'' if _solids_tested(data, target) else 'not '}tested in this atmosphere.")
    rules = data.ranking.rules
    return {
        "lead": lead,
        "rows": rows,
        "not_scored": [
            {
                "psi_id": n.psi_id,
                "title": _label(data, n.psi_id),
                "category": rules.categories[n.category].label,
                "reason": n.reason,
                "material_relevance": n.material_relevance,
            }
            for n in ranking.not_scored
        ],
        "evidence": {
            "weighting_label": rules.weighting_label,
            "distance_rule": rules.distance_rule,
            "atmosphere_rule": rules.atmosphere_rule,
            "material_rule": rules.material_rule,
            "sort_rule": rules.sort_rule,
            "weights": {c.label: c.weight for c in rules.categories.values()},
        },
    }
