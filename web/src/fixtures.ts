import type { About, Habitat, MapSnapshot, Point, PointCard, ReportCondition, ScenarioSnapshot, Summary } from "./api";

export const gas: Point = {
  experiment_id: "PSI-159", test_id: "21088A1", o2_pct_min: 39.39, o2_pct_max: 39.39,
  pressure_psi_min: 7.348, pressure_psi_max: 7.348, fuel_state: "gas", pressure_basis: "table",
  source_file: "PSI-159_Experimental table_CFI-G_Normal Flames.csv", source_row: 2,
};
export const liquid: Point = {
  experiment_id: "PSI-69", test_id: "37", o2_pct_min: 34, o2_pct_max: 34,
  pressure_psi_min: 10.332, pressure_psi_max: 10.332, fuel_state: "liquid", pressure_basis: "table",
  source_file: "PSI-69_Experimental table_FLEX.csv", source_row: 38,
};
export const solid: Point = {
  experiment_id: "PSI-25", test_id: "B1", o2_pct_min: 22.2, o2_pct_max: 22.2,
  pressure_psi_min: 14.7, pressure_psi_max: 14.7, fuel_state: "solid", pressure_basis: "record",
  source_file: "PSI-25_Experimental table_BASS-II.csv", source_row: 2,
};
export const ranged: Point = {
  experiment_id: "PSI-98", test_id: "S1", o2_pct_min: 21.5, o2_pct_max: 21.7,
  pressure_psi_min: 14.47, pressure_psi_max: 14.54, fuel_state: "solid", pressure_basis: "record",
  source_file: "PSI-98_Experimental table_SAFFIRE-1.csv", source_row: 2,
};
export const unrounded: Point = {
  experiment_id: "PSI-10", test_id: "19115A1", o2_pct_min: 20.7128374, o2_pct_max: 20.7128374,
  pressure_psi_min: 14.8681234, pressure_psi_max: 14.8681234, fuel_state: "gas", pressure_basis: "table",
  source_file: "PSI-10_Experimental table_Flame Design_Normal Flame.csv", source_row: 2,
};
export const report: ReportCondition = {
  experiment_id: "PSI-20", test_id: "19070D1", o2_pct_min: 34, o2_pct_max: 34,
  pressure_psi_min: 8.2, pressure_psi_max: 8.2, fuel: "ethylene/N2 on a porous burner", outcome: "steady",
  source: { file: "BRE_final_report_20220201.pdf", page: 26, figure: "Figure 9" },
  outcome_words: "The flame burned steadily.", preset_label: "NASA test atmosphere",
};

export const lunar: Habitat = {
  id: "lunar", label: "Lunar base or rover", kind: "zone", o2_pct_min: 30, pressure_psi_max: 10.2,
  source: "Challenge text: 30% oxygen or more at 10.2 psi or less. Bounds are inclusive.",
};
export const iss: Habitat = {
  id: "iss", label: "ISS cabin", kind: "point", o2_pct: 21, pressure_psi: 14.7,
  source: "Researcher's Guide, page 19",
};
export const spacesuit: Habitat = {
  id: "spacesuit", label: "Spacesuit", kind: "note", o2_pct: 100, pressure_psi: 4.3, source: "Challenge text",
};
export const custom: Habitat = {
  id: "custom", label: "Custom", kind: "point", o2_pct: 28, pressure_psi: 9, source: "Your input",
};

export const lunarSnapshot: MapSnapshot = {
  schema: "spark.snapshot.v1", data_version: "163e1fe25dcd", panel: "map",
  habitat: { id: "lunar", kind: "zone", o2_pct_min: 30, pressure_psi_max: 10.2, source: lunar.source },
  view: {
    ambient_points_shown: 878, burner_points_hidden: 263, report_conditions_shown: 3,
    inside_zone: {
      test_points: 20, by_experiment: { "PSI-159": 20 },
      report_conditions: [{ experiment_id: "PSI-20", test_id: "19070D1" }],
    },
    nearest_outside_zone: [
      { experiment_id: "PSI-69", test_id: "37", basis: "test", o2_pct: 34, pressure_psi: 10.332, gap_o2_pct_points: 0, gap_psi: 0.132, distance: 0.013, source_file: "PSI-69_Experimental table_FLEX.csv", source_row: 38 },
      { experiment_id: "PSI-20", test_id: "19056F1", basis: "report", o2_pct: 27, pressure_psi: 10.2, gap_o2_pct_points: 3, gap_psi: 0, distance: 0.1, source_file: "BRE_final_report_20220201.pdf", source_row: null },
    ],
    experiments_without_conditions: ["PSI-21", "PSI-22", "PSI-47"],
  },
};

export const customSnapshot: MapSnapshot = {
  schema: "spark.snapshot.v1", data_version: "163e1fe25dcd", panel: "map",
  habitat: { id: "custom", kind: "point", o2_pct: 28, pressure_psi: 9, source: "User input" },
  view: {
    ambient_points_shown: 878, burner_points_hidden: 263, report_conditions_shown: 3,
    nearest_tests_by_experiment: [
      { experiment_id: "PSI-20", test_id: "19056F1", basis: "report", o2_pct: 27, pressure_psi: 10.2, gap_o2_pct_points: -1, gap_psi: 1.2, distance: 0.138, source_file: "BRE_final_report_20220201.pdf", source_row: null },
    ],
    experiments_without_conditions: ["PSI-21"],
  },
};

export const far: Point = {
  experiment_id: "PSI-39", test_id: "1356", o2_pct_min: 21, o2_pct_max: 21,
  pressure_psi_min: 73.479, pressure_psi_max: 73.479, fuel_state: "liquid", pressure_basis: "table",
  source_file: "PSI-39_Experimental table_CFI.csv", source_row: 64,
};
export const reportFar: ReportCondition = {
  experiment_id: "PSI-20", test_id: "19999X1", o2_pct_min: 30, o2_pct_max: 30,
  pressure_psi_min: 30, pressure_psi_max: 30, fuel: "ethylene/N2 on a porous burner", outcome: "steady",
  source: { file: "BRE_final_report_20220201.pdf", page: 1, figure: "Figure 1" },
  outcome_words: "The flame burned steadily.",
};

export const scenarioSnapshot: ScenarioSnapshot = {
  schema: "spark.snapshot.v1", data_version: "163e1fe25dcd", panel: "scenario",
  habitat: { id: "custom", kind: "point", o2_pct: 28, pressure_psi: 9, source: "User input" },
  view: {
    distance_rule: "Each gap is a share of the target's own value: distance = hypot(oxygen gap / target oxygen, pressure gap / target pressure). A test inside the zone has distance 0.",
    tests_at_target: 0,
    inside_lunar_zone: false,
    nearest_tests: [
      { experiment_id: "PSI-20", test_id: "19056F1", basis: "report", o2_pct: 27, pressure_psi: 10.2, gap_o2_pct_points: -1, gap_psi: 1.2, distance: 0.138, source_file: "BRE_final_report_20220201.pdf", source_row: null },
      { experiment_id: "PSI-20", test_id: "19070K1", basis: "report", o2_pct: 26.5, pressure_psi: 10.2, gap_o2_pct_points: -1.5, gap_psi: 1.2, distance: 0.144, source_file: "BRE_final_report_20220201.pdf", source_row: null },
      { experiment_id: "PSI-69", test_id: "41", basis: "test", o2_pct: 30, pressure_psi: 10.332, gap_o2_pct_points: 2, gap_psi: 1.332, distance: 0.164, source_file: "PSI-69_Experimental table_FLEX.csv", source_row: 42 },
      { experiment_id: "PSI-69", test_id: "43", basis: "test", o2_pct: 30, pressure_psi: 10.343, gap_o2_pct_points: 2, gap_psi: 1.343, distance: 0.165, source_file: "PSI-69_Experimental table_FLEX.csv", source_row: 44 },
      { experiment_id: "PSI-69", test_id: "42", basis: "test", o2_pct: 30, pressure_psi: 10.345, gap_o2_pct_points: 2, gap_psi: 1.345, distance: 0.166, source_file: "PSI-69_Experimental table_FLEX.csv", source_row: 43 },
    ],
  },
};

export const aboutFixture: About = {
  data_version: "abc123def456",
  distance_rule: "Each gap is a share of the target's own value: distance = hypot(oxygen gap / target oxygen, pressure gap / target pressure). A test inside the zone has distance 0.",
  sources: [
    { label: "Test points", path: "data/clean/test_points.json", count: 878 },
    { label: "Report conditions", path: "data/reference/report_conditions.json", count: 3, files: ["BRE_final_report_20220201.pdf"] },
    { label: "Experiment records", path: "data/clean/experiments.json", count: 24 },
  ],
  known_problems: [
    "PSI-39: 8 repeated rows were dropped. One copy of each was kept.",
    "263 burner-oxygen points are kept off the map.",
  ],
};

export const lunarSummary: Summary = {
  lead: [
    "20 tests ran inside the lunar zone.",
    "All of them were gas flames on a burner.",
    "A NASA report also describes 1 test inside it.",
    "No solid material or liquid fuel was tested here.",
  ],
  know: ["Gas flames on a burner: 20 tests ran inside the lunar zone."],
  dont_know: [
    "Solid material: no test ran inside the lunar zone.",
    "The closest was PSI-98: 8.3 points too little oxygen and 4.27 psi too much pressure.",
    "Liquid fuel: no test ran inside the lunar zone.",
    "The closest was PSI-69: 0.13 psi too much pressure.",
    "16 of 24 experiments have no per-test conditions, so they are not on the map.",
  ],
};

export const customSummary: Summary = {
  lead: [
    "No test ran at exactly this condition.",
    "The closest evidence is a NASA report on ACME/BRE (PSI-20) at 27 % oxygen and 10.2 psi.",
    "It burned ethylene/N2 on a porous burner.",
    "The flame went out by itself after 45 s.",
    "It had 1 point less oxygen and 1.2 psi more pressure than your target.",
  ],
  know: [],
  dont_know: [
    "Solid material: no test ran at exactly this condition.",
    "The closest was PSI-98: 6.3 points less oxygen and 5.47 psi more pressure than your target.",
    "16 of 24 experiments have no per-test conditions, so they are not on the map.",
  ],
};

export const gasCard: PointCard = {
  title: "ACME CFI-G (PSI-159)",
  burned: "a gas flame on a burner, ethane",
  conditions: "39.39 % oxygen at 13.7 psi",
  result: "The flame went out by itself.",
  evidence: {
    experiment_id: "PSI-159", test_id: "21088A1", source_file: gas.source_file, source_row: 2,
    page: null, figure: null, pressure_note: null,
  },
};
export const solidCard: PointCard = {
  title: "BASS-II (PSI-25)",
  burned: "a burning solid sample, 100 micron PMMA film   2 cm wide",
  conditions: "22.2 % oxygen at 14.7 psi",
  result: "The tables do not record how this test ended.",
  evidence: {
    experiment_id: "PSI-25", test_id: "B1", source_file: solid.source_file, source_row: 2,
    page: null, figure: null, pressure_note: "The pressure comes from the experiment record, not the test table.",
  },
};
export const reportCard: PointCard = {
  title: "ACME/BRE (PSI-20)",
  burned: "ethylene/N2 on a porous burner",
  conditions: "34 % oxygen at 8.2 psi",
  result: "The flame burned steadily.",
  evidence: {
    experiment_id: "PSI-20", test_id: "19070D1", source_file: "BRE_final_report_20220201.pdf", source_row: null,
    page: 26, figure: "Figure 9", pressure_note: null,
  },
};
