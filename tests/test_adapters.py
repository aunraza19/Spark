from collections import Counter
from pathlib import Path

import pytest
from pytest import approx
from spark_data.adapters import ADAPTERS, Adapter, Exclusion, read_table
from spark_data.validate import validate_records

INCOMING = Path(__file__).resolve().parents[1] / "data" / "incoming"
TABLES = INCOMING / "test-tables"
ONE_ATM_PSI = 101325 / 6894.757293168
ONE_BAR_PSI = 100000 / 6894.757293168
ONE_MMHG_PSI = ONE_ATM_PSI / 760

PSI10_NORMAL = "PSI-10_Experimental table_Flame Design_Normal Flame.csv"
PSI10_INVERSE = "PSI-10_Experimental table_Flame Design_Inverse Flame.csv"
PSI159_NORMAL = "PSI-159_Experimental table_CFI-G_Normal Flames.csv"
PSI159_INVERSE = "PSI-159_Experimental table_CFI-G_Inverse Flames.csv"
PSI39 = "PSI-39_Experimental table_CFI.csv"
PSI69 = "PSI-69_Experimental table_FLEX.csv"
PSI25 = "PSI-25_Experimental table_BASS-II.csv"
PSI98 = "PSI-98_Experimental table_SAFFIRE-1.csv"
PSI99 = "PSI-99_Experimental table_SAFFIRE-2.csv"


@pytest.fixture(scope="module")
def experiments():
    valid, _ = validate_records(INCOMING / "experiments")
    return valid


@pytest.fixture
def read_real(experiments):
    def read(file):
        adapter = ADAPTERS[file]
        return read_table(adapter, TABLES / file, experiments[adapter.experiment])

    return read


def make_table(tmp_path, text, **changes):
    """Write a small CSV and return an adapter for it."""
    path = tmp_path / "t.csv"
    path.write_text(text, encoding="utf-8", newline="")
    settings = {
        "file": "t.csv", "experiment": "PSI-98", "test_id": "Test", "o2": "O2",
        "pressure": "P", "pressure_unit": "atm",
    }
    return Adapter(**{**settings, **changes}), path


def assert_pressure(points, low, high):
    assert all(p.pressure_psi_min == approx(low) for p in points)
    assert all(p.pressure_psi_max == approx(high) for p in points)


# --- rules, on small tables ---------------------------------------------------


def test_a_new_table_needs_only_an_adapter_entry(tmp_path, experiments):
    adapter, path = make_table(tmp_path, "Test,O2,P\nA1,0.21,1\n")
    result = read_table(adapter, path, experiments["PSI-98"])
    (point,) = result.points
    assert point.experiment_id == "PSI-98"
    assert point.test_id == "A1"
    assert point.o2_pct_min == approx(21.0)
    assert point.o2_pct_max == approx(21.0)
    assert point.pressure_psi_min == approx(ONE_ATM_PSI)
    assert point.pressure_psi_max == approx(ONE_ATM_PSI)
    assert point.pressure_basis == "table"
    assert (point.source_file, point.source_row) == ("t.csv", 2)


def test_header_whitespace_is_ignored(tmp_path, experiments):
    adapter, path = make_table(tmp_path, " Test ,  O2  , P\nA1,0.21,1\n")
    assert len(read_table(adapter, path, experiments["PSI-98"]).points) == 1


def test_a_row_with_bad_oxygen_or_pressure_is_excluded_with_a_reason(tmp_path, experiments):
    text = "Test,O2,P\nA1,RAMP,1\nA2,34,1\nA3,0.21,0\nA4,0.21,\nA5,0.21,1\n"
    adapter, path = make_table(tmp_path, text)
    result = read_table(adapter, path, experiments["PSI-98"])
    assert [p.test_id for p in result.points] == ["A5"]
    assert [(e.row, e.test_id) for e in result.excluded] == [(2, "A1"), (3, "A2"), (4, "A3"), (5, "A4")]
    assert result.excluded_reasons == Counter({
        "oxygen: not a number: 'RAMP'": 1,
        "oxygen: oxygen 3400 % is outside 0 to 100 %": 1,
        "pressure: pressure 0 atm is zero or below": 1,
        "pressure: empty cell": 1,
    })
    assert result.rows_read == 5


def test_blank_rows_are_skipped_and_not_counted_as_excluded(tmp_path, experiments):
    adapter, path = make_table(tmp_path, "Test,O2,P\nA1,0.21,1\n,,\n\n , ,\n")
    result = read_table(adapter, path, experiments["PSI-98"])
    assert len(result.points) == 1
    assert result.blank_rows == 3
    assert result.excluded == []
    assert result.rows_read == 1


def test_exact_duplicate_rows_are_dropped_and_listed(tmp_path, experiments):
    adapter, path = make_table(tmp_path, "Test,O2,P\nA1,0.21,1\nA2,0.30,1\nA1,0.21,1\n")
    result = read_table(adapter, path, experiments["PSI-98"])
    assert [p.test_id for p in result.points] == ["A1", "A2"]
    assert [(d.row, d.test_id, d.first_row) for d in result.duplicates] == [(4, "A1", 2)]
    assert result.rows_read == 3


def test_a_null_fuel_flow_keeps_the_point_and_counts_the_reason(tmp_path, experiments):
    adapter, path = make_table(tmp_path, "Test,O2,P,Flow\nA1,0.21,1,RAMP\nA2,0.21,1,0.5\n", fuel_flow="Flow")
    result = read_table(adapter, path, experiments["PSI-98"])
    assert [p.fuel_flow_mg_s for p in result.points] == [None, approx(0.5)]
    assert result.null_fields == Counter({("fuel_flow_mg_s", "not a number: 'RAMP'"): 1})


def test_pressure_comes_from_the_record_when_the_table_has_none(tmp_path, experiments):
    adapter, path = make_table(tmp_path, "Test,O2\nA1,21.5\n", pressure=None, pressure_unit=None, o2_kind="percent")
    (point,) = read_table(adapter, path, experiments["PSI-98"]).points
    assert point.pressure_psi_min == approx(14.47)
    assert point.pressure_psi_max == approx(14.54)
    assert point.pressure_basis == "record"


def test_rows_are_excluded_when_neither_table_nor_record_has_pressure(tmp_path, experiments):
    # The PSI-47 record has no pressure range.
    adapter, path = make_table(
        tmp_path, "Test,O2\nA1,21.5\n", experiment="PSI-47", pressure=None, pressure_unit=None, o2_kind="percent"
    )
    result = read_table(adapter, path, experiments["PSI-47"])
    assert result.points == []
    assert [e.reason for e in result.excluded] == ["pressure: the record gives no pressure range"]


def test_a_column_missing_from_the_file_is_an_error(tmp_path, experiments):
    adapter, path = make_table(tmp_path, "Test,Oxygen,P\nA1,0.21,1\n")
    with pytest.raises(ValueError, match="O2"):
        read_table(adapter, path, experiments["PSI-98"])


# --- the real tables ----------------------------------------------------------


def test_psi10_normal_gives_207_points_and_60_have_no_fuel_flow(read_real):
    result = read_real(PSI10_NORMAL)
    assert len(result.points) == 207
    assert result.excluded == [] and result.duplicates == [] and result.blank_rows == 0
    assert sum(p.fuel_flow_mg_s is None for p in result.points) == 60
    assert result.null_fields == Counter({
        ("fuel_flow_mg_s", "not a number: 'RAMP'"): 57,
        ("fuel_flow_mg_s", "not a number: 'RAMPED'"): 3,
    })
    # First data row: test 19115A1.
    first = result.points[0]
    assert (first.test_id, first.fuel, first.fuel_state) == ("19115A1", "C2H4", "gas")
    assert first.o2_pct_min == approx(0.207128374 * 100)
    assert first.pressure_psi_min == approx(1.01184402 * ONE_ATM_PSI)
    assert first.fuel_flow_mg_s == approx(0.968953877)
    assert first.source_row == 2
    assert min(p.o2_pct_min for p in result.points) == approx(0.198048193 * 100)
    assert max(p.o2_pct_min for p in result.points) == approx(40.0)


def test_psi10_inverse_excludes_the_ramp_and_low_o2_rows(read_real):
    result = read_real(PSI10_INVERSE)
    assert len(result.points) == 109
    assert result.excluded_reasons == Counter({
        "oxygen: not a number: 'RAMP'": 9,
        "oxygen: not a number: 'LOW O2'": 2,
    })
    assert result.basis == "burner"
    assert {p.fuel for p in result.points} == {None}


def test_psi39_drops_the_8_exact_duplicates(read_real):
    result = read_real(PSI39)
    assert result.rows_read == 87
    assert len(result.points) == 79
    assert sorted(d.test_id for d in result.duplicates) == [
        "1285", "1286", "1287", "1288", "1289", "1295", "1296", "1297",
    ]
    assert min(p.pressure_psi_min for p in result.points) == approx(0.5 * ONE_ATM_PSI)
    assert max(p.pressure_psi_min for p in result.points) == approx(5 * ONE_ATM_PSI)
    assert sorted({round(p.o2_pct_min, 9) for p in result.points}) == approx([17.0, 21.0])


def test_psi69_excludes_test_114_with_pressure_zero(read_real):
    result = read_real(PSI69)
    assert len(result.points) == 273
    assert result.excluded == [Exclusion(115, "114", "pressure: pressure 0 mmHg is zero or below")]
    smallest = min(p.pressure_psi_min for p in result.points)
    assert smallest == approx(526.3 * ONE_MMHG_PSI)
    assert max(p.pressure_psi_min for p in result.points) == approx(2319.9 * ONE_MMHG_PSI)
    assert min(p.o2_pct_min for p in result.points) == approx(12.0)
    assert max(p.o2_pct_min for p in result.points) == approx(34.0)
    assert {p.fuel for p in result.points} == {"Methanol", "Heptane"}



def test_psi159_normal_gives_179_points_from_bar(read_real):
    result = read_real(PSI159_NORMAL)
    assert len(result.points) == 179
    assert result.excluded == [] and result.duplicates == []
    assert min(p.o2_pct_min for p in result.points) == approx(0.179685675 * 100)
    assert max(p.o2_pct_min for p in result.points) == approx(0.3997 * 100)
    assert min(p.pressure_psi_min for p in result.points) == approx(0.50665 * ONE_BAR_PSI)
    assert max(p.pressure_psi_min for p in result.points) == approx(3.0399 * ONE_BAR_PSI)
    assert Counter(p.outcome for p in result.points) == Counter({"SE": 102, "FT": 31, "-": 46})


def test_psi159_inverse_gives_154_points_and_skips_861_blank_rows(read_real):
    result = read_real(PSI159_INVERSE)
    assert len(result.points) == 154
    assert result.blank_rows == 861
    assert result.excluded == [] and result.duplicates == []
    assert result.basis == "burner"


def test_psi25_uses_the_record_pressure(read_real):
    result = read_real(PSI25)
    assert len(result.points) == 129
    assert result.points[0].test_id == "B1"
    assert {p.pressure_basis for p in result.points} == {"record"}
    assert_pressure(result.points, 14.7, 14.7)
    assert min(p.o2_pct_min for p in result.points) == approx(13.6)
    assert max(p.o2_pct_min for p in result.points) == approx(22.2)


def test_psi98_gives_2_points_and_excludes_the_2_flow_visualisation_rows(read_real):
    result = read_real(PSI98)
    assert [(p.test_id, p.o2_pct_min, p.o2_pct_max, p.o2_approximate) for p in result.points] == [
        ("S1", approx(21.5), approx(21.7), False),
        ("S2", approx(21.5), approx(21.5), True),
    ]
    assert_pressure(result.points, 14.47, 14.54)
    assert [e.test_id for e in result.excluded] == ["F1C1/F1C2", "F2C1/F2C2"]


def test_psi99_gives_9_points_and_excludes_6_other_rows(read_real):
    result = read_real(PSI99)
    assert [(p.test_id, p.o2_pct_min, p.o2_pct_max, p.o2_approximate) for p in result.points] == [
        ("2-1", approx(21.5), approx(21.5), True),
        *[(f"2-{n}", approx(22.1), approx(22.1), True) for n in range(2, 8)],
        ("2-8", approx(22.0), approx(22.1), False),
        ("2-9", approx(21.9), approx(22.0), False),
    ]
    assert_pressure(result.points, 14.56, 14.64)
    assert len(result.excluded) == 6


NO_POINTS = [
    # file, data rows, exact duplicate rows
    ("PSI-20_Experimental table_ACME BRE.csv", 18, 0),
    ("PSI-21_Experimental table_CLD Flame.csv", 32, 0),
    ("PSI-22_Experimental table_ACME E-FIELD Flames.csv", 32, 8),
    ("PSI-23_Experimental table_ACME s-Flame.csv", 18, 0),
    ("PSI-26_Experimental table_BASS.csv", 122, 0),
    ("PSI-47_Experimental table_DAFT.csv", 2, 0),
    ("PSI-68_Experimental table_Flex2.csv", 8, 0),
    ("PSI-100_Experimental table_SAFFIRE-3.csv", 2, 0),
    ("PSI-101_Experimental table_SAME-R.csv", 109, 0),
    ("PSI-102_Experimental table_SAME.csv", 8, 0),
    ("PSI-106_Experimental table_Slice.csv", 12, 0),
    ("PSI-107_Experimental table_Spice.csv", 469, 34),
]


@pytest.mark.parametrize("file, rows, duplicates", NO_POINTS)
def test_tables_without_per_test_oxygen_and_pressure_give_no_points(read_real, file, rows, duplicates):
    result = read_real(file)
    assert result.points == []
    assert result.rows_read == rows
    assert len(result.duplicates) == duplicates
    assert result.excluded_reasons == Counter({ADAPTERS[file].no_points: rows - duplicates})
    assert ADAPTERS[file].no_points


def test_every_table_accounts_for_every_row(read_real):
    for file in ADAPTERS:
        result = read_real(file)
        counted = len(result.points) + sum(result.excluded_reasons.values()) + len(result.duplicates)
        assert counted == result.rows_read, file


def test_every_csv_has_an_adapter():
    assert {p.name for p in TABLES.glob("*.csv")} == set(ADAPTERS)


def test_every_point_names_its_source(read_real):
    for file in (PSI10_NORMAL, PSI39, PSI69, PSI25):
        for point in read_real(file).points:
            assert point.source_file == file
            assert point.source_row >= 2
