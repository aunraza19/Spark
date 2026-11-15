export type Habitat = {
  id: string;
  label: string;
  kind: "zone" | "point" | "note";
  source: string;
  o2_pct_min?: number;
  pressure_psi_max?: number;
  o2_pct?: number;
  pressure_psi?: number;
};

export type Point = {
  experiment_id: string;
  test_id: string | null;
  o2_pct_min: number;
  o2_pct_max: number;
  pressure_psi_min: number;
  pressure_psi_max: number;
  fuel_state: string | null;
  pressure_basis: "table" | "record";
  source_file: string;
  source_row: number;
};

export type ReportCondition = {
  experiment_id: string;
  test_id: string;
  o2_pct_min: number;
  o2_pct_max: number;
  pressure_psi_min: number;
  pressure_psi_max: number;
  fuel: string;
  outcome: string;
  source: { file: string; page: number; figure: string };
  outcome_words: string;
  preset_label?: string;
  note?: string;
};

export type SnapshotEntry = {
  experiment_id: string;
  test_id: string | null;
  basis: "test" | "report";
  o2_pct: number;
  pressure_psi: number;
  gap_o2_pct_points: number;
  gap_psi: number;
  distance: number;
  source_file: string;
  source_row: number | null;
};

export type MapSnapshot = {
  schema: string;
  data_version: string;
  panel: "map";
  habitat: { id: string; kind: string; source: string; o2_pct_min?: number; pressure_psi_max?: number; o2_pct?: number; pressure_psi?: number };
  view: {
    ambient_points_shown: number;
    burner_points_hidden: number;
    report_conditions_shown: number;
    inside_zone?: {
      test_points: number;
      by_experiment: Record<string, number>;
      report_conditions: { experiment_id: string; test_id: string }[];
    };
    nearest_outside_zone?: SnapshotEntry[];
    nearest_tests_by_experiment?: SnapshotEntry[];
    experiments_without_conditions: string[];
    pressure_range_shown?: [number, number];
    points_not_shown?: number;
    report_conditions_not_shown?: number;
  };
};

export type Selection = { habitatId: string; custom?: { o2: number; psi: number } };

export type Summary = { lead: string[]; know: string[]; dont_know: string[] };

export type Preset = { label: string; o2: number; psi: number; source: string };

export type About = {
  data_version: string;
  distance_rule: string;
  sources: { label: string; path: string; count: number; files?: string[] }[];
  known_problems: string[];
};

export const fetchAbout = () => getJson<About>("/api/about");

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

export const fetchHabitats = () => getJson<Habitat[]>("/api/habitats");
export const fetchPoints = () => getJson<Point[]>("/api/points");
export const fetchReportConditions = () => getJson<ReportCondition[]>("/api/report-conditions");

export function fetchMapSnapshot(selection: Selection, shownPsiMax: number) {
  const query =
    selection.habitatId === "custom" && selection.custom
      ? `habitat=custom&o2=${selection.custom.o2}&psi=${selection.custom.psi}`
      : `habitat=${selection.habitatId}`;
  return getJson<{ key: string; snapshot: MapSnapshot; summary?: Summary }>(
    `/api/snapshot/map?${query}&shown_psi_max=${shownPsiMax}`,
  );
}

export type ScenarioSnapshot = {
  schema: string;
  data_version: string;
  panel: "scenario";
  habitat: { id: string; kind: string; source: string; o2_pct: number; pressure_psi: number };
  view: {
    distance_rule: string;
    tests_at_target: number;
    nearest_tests: SnapshotEntry[];
    inside_lunar_zone: boolean;
  };
};

export const fetchScenarioSnapshot = (custom: { o2: number; psi: number }) =>
  getJson<{ key: string; snapshot: ScenarioSnapshot }>(`/api/snapshot/scenario?o2=${custom.o2}&psi=${custom.psi}`);
