import type { Habitat, MapSnapshot, Point, ReportCondition } from "./api";

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
