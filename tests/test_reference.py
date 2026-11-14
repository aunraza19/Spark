import json
import shutil
from pathlib import Path

import pytest
from pydantic import ValidationError
from pytest import approx
from spark_data.adapters import ADAPTERS
from spark_data.models import Habitat
from spark_data.reference import in_zone, load_reference

REPO = Path(__file__).resolve().parents[1]
REFERENCE = REPO / "data" / "reference"
FLIGHT = {10, 20, 21, 22, 23, 25, 26, 39, 47, 68, 69, 98, 99, 100, 101, 102, 106, 107, 159}
GROUND = {60, 62, 115, 117, 142}
# The 14 files in data/incoming/documents, from the folder listing.
PDF_FILES = {
    "BASS-II Summary Report.pdf",
    "BRE_final_report_20220201.pdf",
    "CFI Science Final Report.pdf",
    "DAFT final report 6 24 08 d.pdf",
    "E-FIELD Flames Final Report.pdf",
    "NNX17AF08A_FinalReport.pdf",
    "PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf",
    "PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated An.pdf",
    "PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf",
    "SAME Final Science report  03 18 10 with papers attached.pdf",
    "SAMER_Final 0602 2014.pdf",
    "SPICE Final Report 12_2_2012.pdf",
    "np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf",
    "s_Flame_final_report_20210729.pdf",
}


@pytest.fixture(scope="module")
def reference():
    return load_reference(REFERENCE)


def habitat(reference, name):
    return next(h for h in reference.habitats if h.id == name)


def test_lunar_zone_values_and_source(reference):
    lunar = habitat(reference, "lunar")
    assert lunar.kind == "zone"
    assert lunar.o2_pct_min == approx(30)
    assert lunar.pressure_psi_max == approx(10.2)
    assert "Challenge text" in lunar.source


def test_iss_is_one_point_with_its_source(reference):
    iss = habitat(reference, "iss")
    assert iss.kind == "point"
    assert (iss.o2_pct, iss.pressure_psi) == approx((21, 14.7))
    assert "Researcher's Guide, page 19" in iss.source
    assert "nominally 21 percent oxygen by volume and one atmospheric pressure" in iss.source


def test_spacesuit_is_a_note_only(reference):
    suit = habitat(reference, "spacesuit")
    assert suit.kind == "note"
    assert (suit.o2_pct, suit.pressure_psi) == approx((100, 4.3))
    assert "Challenge text" in suit.source


def test_lunar_zone_values_are_not_typed_into_code():
    sources = [*(REPO / "backend").rglob("*.py"), *(REPO / "scripts").rglob("*.py")]
    assert sources
    for path in sources:
        assert "10.2" not in path.read_text(encoding="utf-8"), path


def test_zone_bounds_are_inclusive(reference):
    lunar = habitat(reference, "lunar")
    assert in_zone(30, 10.2, lunar)
    assert not in_zone(29.99, 10.2, lunar)
    assert not in_zone(30, 10.21, lunar)


def test_a_range_is_in_the_zone_only_if_all_of_it_is(reference):
    lunar = habitat(reference, "lunar")
    # A point with oxygen 29 to 31 % reaches below 30 %.
    assert not in_zone(29, 10.2, lunar)


def test_registry_lists_the_24_experiments(reference):
    experiments = reference.registry.experiments
    assert {e.psi_id for e in experiments if e.kind == "flight"} == {f"PSI-{n}" for n in FLIGHT}
    assert {e.psi_id for e in experiments if e.kind == "ground"} == {f"PSI-{n}" for n in GROUND}
    assert len(experiments) == 24


def test_flight_experiments_expect_a_table_and_ground_ones_do_not(reference):
    for e in reference.registry.experiments:
        assert e.test_table == ("expected" if e.kind == "flight" else "none"), e.psi_id


def test_every_adapter_belongs_to_a_registered_flight_experiment(reference):
    flight = {e.psi_id for e in reference.registry.experiments if e.kind == "flight"}
    assert {a.experiment for a in ADAPTERS.values()} == flight


def test_outside_psi_experiments_have_labels_only(reference):
    entries = reference.registry.outside_psi
    assert {e.label for e in entries} == {"SoFIE", "FM2", "Saffire-IV", "Saffire-V", "Saffire-VI"}
    for entry in entries:
        assert entry.model_dump() == {"label": entry.label, "status": "outside_psi"}


def test_registry_maps_all_14_documents(reference):
    registry = reference.registry
    files = [r.file for e in registry.experiments for r in e.reports]
    files += [d.file for d in registry.general_documents]
    assert sorted(files) == sorted(PDF_FILES)


def test_document_mapping_status(reference):
    reports = {r.file: (e.psi_id, r) for e in reference.registry.experiments for r in e.reports}
    assert reports["BRE_final_report_20220201.pdf"][0] == "PSI-20"
    assert reports["BRE_final_report_20220201.pdf"][1].status == "verified"
    assert reports["NNX17AF08A_FinalReport.pdf"][0] == "PSI-115"
    assert reports["NNX17AF08A_FinalReport.pdf"][1].status == "verified"
    expected = {
        "BASS-II Summary Report.pdf": "PSI-25",
        "CFI Science Final Report.pdf": "PSI-39",
        "DAFT final report 6 24 08 d.pdf": "PSI-47",
        "E-FIELD Flames Final Report.pdf": "PSI-22",
        "PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf": "PSI-10",
        "PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf": "PSI-159",
        "SAME Final Science report  03 18 10 with papers attached.pdf": "PSI-102",
        "SAMER_Final 0602 2014.pdf": "PSI-101",
        "SPICE Final Report 12_2_2012.pdf": "PSI-107",
        "s_Flame_final_report_20210729.pdf": "PSI-23",
    }
    for file, psi_id in expected.items():
        assert reports[file][0] == psi_id
        assert reports[file][1].status == "unverified"
    (psi117,) = [r for f, (i, r) in reports.items() if i == "PSI-117"]
    assert psi117.status == "unverified"
    assert "title does not match" in psi117.note


def test_the_mini_book_is_the_researchers_guide_and_belongs_to_no_experiment(reference):
    (guide,) = reference.registry.general_documents
    assert guide.title == "Researcher's Guide"
    assert guide.status == "verified"
    assert guide.file.startswith("np-2015-10-034")


def test_open_questions_name_the_experiments(reference):
    assert [q.experiment for q in reference.registry.open_questions] == [
        "PSI-21", "PSI-22", "PSI-20", "PSI-26", "PSI-22", "PSI-107",
    ]


def test_report_conditions_are_the_three_bre_entries(reference):
    by_id = {c.test_id: c for c in reference.report_conditions}
    expected = {
        "19070K1": (26.5, 10.2, "steady", 25, "Figure 7"),
        "19070D1": (34, 8.2, "steady", 26, "Figure 9"),
        "19056F1": (27, 10.2, "self-extinguished at 45 s", 25, "Figure 6"),
    }
    assert set(by_id) == set(expected)
    for test_id, (o2, pressure, outcome, page, figure) in expected.items():
        condition = by_id[test_id]
        assert (condition.o2_pct_min, condition.o2_pct_max) == approx((o2, o2))
        assert (condition.pressure_psi_min, condition.pressure_psi_max) == approx((pressure, pressure))
        assert (condition.outcome, condition.source.page, condition.source.figure) == (outcome, page, figure)
    assert {c.experiment_id for c in reference.report_conditions} == {"PSI-20"}
    assert {c.source.file for c in reference.report_conditions} == {"BRE_final_report_20220201.pdf"}
    assert {c.fuel for c in reference.report_conditions} == {"ethylene/N2 on a porous burner"}
    note = next(c.note for c in reference.report_conditions if c.test_id == "19056F1")
    assert "26.5%" in note


def test_a_misspelled_field_in_a_reference_file_is_rejected():
    with pytest.raises(ValidationError):
        Habitat.model_validate({"id": "x", "label": "x", "kind": "zone", "source": "x", "o2_pct_mn": 30})


def test_a_reference_file_with_a_bad_value_is_rejected(tmp_path):
    for name in ("habitats.json", "registry.json", "report_conditions.json"):
        shutil.copy(REFERENCE / name, tmp_path / name)
    habitats = json.loads((tmp_path / "habitats.json").read_text(encoding="utf-8"))
    habitats[0]["kind"] = "region"
    (tmp_path / "habitats.json").write_text(json.dumps(habitats), encoding="utf-8")
    with pytest.raises(ValidationError):
        load_reference(tmp_path)
