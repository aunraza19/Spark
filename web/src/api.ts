export type Habitat = {
  id: string;
  label: string;
  short_name?: string;
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

export class ApiError extends Error {
  constructor(
    url: string,
    readonly status: number,
  ) {
    super(`${url}: ${status}`);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new ApiError(url, response.status);
  return response.json() as Promise<T>;
}

export type ExperimentRow = {
  psi_id: string;
  name: string;
  kind: "flight" | "ground";
  fuel_type: string;
  tests: number;
  report_conditions: number;
  tests_with_conditions: number;
  tests_text: string;
};

export type ExperimentPageData = {
  psi_id: string;
  title: string;
  name: string;
  acronym: string | null;
  kind: "flight" | "ground";
  lead: string[];
  key_results: string[];
  evidence: {
    conditions: {
      tests_on_map: number;
      report_conditions_on_map: number;
      ranges: { o2_pct: [number, number]; pressure_psi: [number, number] } | null;
      source_files: string[];
      record_note: string;
    };
    fuels: string[] | null;
    sensors: string[];
    publications: { title: string; authors: string | null; doi: string | null; link: string | null }[];
    data_quality_notes: string[];
    record_file: string;
    report_files: string[];
  };
};

export type RankedRow = {
  rank: number;
  psi_id: string;
  title: string;
  category: string;
  match: number;
  tests_inside_zone: number | null;
  tests_with_conditions: number;
  material_relevance: number;
};

export type RankingView = {
  lead: string[];
  rows: RankedRow[];
  not_scored: { psi_id: string; title: string; category: string; reason: string; material_relevance: number }[];
  evidence: {
    weighting_label: string;
    distance_rule: string;
    atmosphere_rule: string;
    material_rule: string;
    sort_rule: string;
    weights: Record<string, number>;
  };
};

export const fetchExperimentList = () => getJson<ExperimentRow[]>("/api/experiment-list");
export const fetchExperimentPage = (psiId: string) =>
  getJson<ExperimentPageData>(`/api/experiment-page/${encodeURIComponent(psiId)}`);

export function fetchRanking(selection: Selection) {
  const query =
    selection.habitatId === "custom" && selection.custom
      ? `habitat=custom&o2=${selection.custom.o2}&psi=${selection.custom.psi}`
      : `habitat=${selection.habitatId}`;
  return getJson<RankingView>(`/api/ranking?${query}`);
}

export const fetchHabitats = () => getJson<Habitat[]>("/api/habitats");
export const fetchPoints = () => getJson<Point[]>("/api/points");
export const fetchReportConditions = () => getJson<ReportCondition[]>("/api/report-conditions");

export type CardRequest = { source_file: string; source_row: number } | { experiment_id: string; test_id: string };

export type PointCard = {
  title: string;
  burned: string;
  conditions: string;
  result: string;
  evidence: {
    experiment_id: string;
    test_id: string | null;
    source_file: string;
    source_row: number | null;
    page: number | null;
    figure: string | null;
    pressure_note: string | null;
  };
};

export function fetchPointCard(request: CardRequest) {
  const query = new URLSearchParams(
    Object.entries(request).map(([key, value]) => [key, String(value)]),
  );
  return getJson<PointCard>(`/api/point-card?${query}`);
}

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

export type BlockSpec =
  | { kind: "map"; habitat: string; o2?: number; psi?: number; shown_psi_max?: number }
  | { kind: "scenario"; o2: number; psi: number }
  | { kind: "ranking"; habitat: string; o2?: number; psi?: number }
  | { kind: "experiment"; experiment_id: string };

export type AgentAnswer = { seeing: string; fire_safety: string; cannot_tell: string; sources: string[] };

export type Explanation =
  | { status: "ok"; answer: AgentAnswer; key: string; model: string; cached: boolean }
  | { status: "unchecked" }
  | { status: "busy" }
  | { status: "unavailable" };

export async function fetchExplanation(block: BlockSpec): Promise<Explanation> {
  try {
    const response = await fetch("/api/agent/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block }),
    });
    const body = (await response.json()) as Explanation;
    return response.ok || body.status === "unavailable" ? body : { status: "busy" };
  } catch {
    return { status: "busy" };
  }
}
