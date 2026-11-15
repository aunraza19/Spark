import type { Habitat, Point, ReportCondition } from "./api";
import { PRESSURE_VIEWS, type PressureView } from "./scale";

export type Hidden = { points: number; reports: number };

export function isVisible(pressureMax: number, view: PressureView): boolean {
  return pressureMax <= PRESSURE_VIEWS[view][1];
}

export function hiddenCounts(points: Point[], reports: ReportCondition[], view: PressureView): Hidden {
  return {
    points: points.filter((p) => !isVisible(p.pressure_psi_max, view)).length,
    reports: reports.filter((c) => !isVisible(c.pressure_psi_max, view)).length,
  };
}

export function needsFullRange(habitat: Habitat | null): boolean {
  return habitat?.id === "custom" && (habitat.pressure_psi ?? 0) > PRESSURE_VIEWS.zoomed[1];
}

const noun = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function viewNote(hidden: Hidden, view: PressureView, forced: boolean): string {
  const [, fullMax] = PRESSURE_VIEWS.full;
  const [, zoomedMax] = PRESSURE_VIEWS.zoomed;
  if (view === "full") {
    return `Showing the full range, 0 to ${fullMax} psi${forced ? `, because your target is above ${zoomedMax} psi` : ""}.`;
  }
  const parts = [`Showing 0 to ${zoomedMax} psi.`];
  parts.push(
    hidden.points === 0
      ? `No test points above ${zoomedMax} psi are hidden.`
      : `${noun(hidden.points, "test point")} above ${zoomedMax} psi ${hidden.points === 1 ? "is" : "are"} not shown.`,
  );
  if (hidden.reports > 0) {
    parts.push(`${noun(hidden.reports, "report condition")} above ${zoomedMax} psi ${hidden.reports === 1 ? "is" : "are"} not shown.`);
  }
  if (hidden.points > 0 || hidden.reports > 0) parts.push("Switch on Show all to see them.");
  return parts.join(" ");
}
