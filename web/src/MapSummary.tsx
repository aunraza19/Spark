import type { MapSnapshot, SnapshotEntry } from "./api";
import { formatNumber } from "./format";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function zoneGaps(entry: SnapshotEntry): string {
  const parts: string[] = [];
  if (entry.gap_o2_pct_points > 0) parts.push(`${plural(entry.gap_o2_pct_points, "point")} of oxygen short`);
  if (entry.gap_psi > 0) parts.push(`${formatNumber(entry.gap_psi)} psi above the limit`);
  return parts.join(" and ");
}

function pointGaps(entry: SnapshotEntry, target: string): string {
  const parts: string[] = [];
  const o2 = entry.gap_o2_pct_points;
  const psi = entry.gap_psi;
  if (o2 !== 0) parts.push(`${formatNumber(Math.abs(o2))} ${Math.abs(o2) === 1 ? "point" : "points"} of oxygen ${o2 < 0 ? "below" : "above"} ${target}`);
  if (psi !== 0) parts.push(`${formatNumber(Math.abs(psi))} psi ${psi < 0 ? "below" : "above"} ${target}`);
  return parts.join(" and ");
}

function Entry({ entry, gaps }: { entry: SnapshotEntry; gaps: string }) {
  const source = entry.source_row === null ? entry.source_file : `${entry.source_file}, row ${entry.source_row}`;
  return (
    <li data-testid="nearest">
      {entry.experiment_id} test {entry.test_id}
      {entry.basis === "report" ? " (from report)" : ""}: {formatNumber(entry.o2_pct)} % oxygen at {formatNumber(entry.pressure_psi)} psi
      {gaps ? `, ${gaps}` : ""}. Source: {source}.
    </li>
  );
}

export function MapSummary({ snapshot }: { snapshot: MapSnapshot | null }) {
  if (!snapshot) return <p>Loading...</p>;
  const { view, habitat } = snapshot;
  const inside = view.inside_zone;
  const target = habitat.id === "custom" ? "your target" : "the reference point";
  return (
    <div className="summary">
      {inside && (
        <p data-testid="inside-zone">
          Inside the zone: {plural(inside.test_points, "test point")}
          {inside.test_points > 0 &&
            ` (${Object.entries(inside.by_experiment).map(([id, n]) => `${id}: ${n}`).join(", ")})`}{" "}
          and {plural(inside.report_conditions.length, "report condition")}
          {inside.report_conditions.length > 0 &&
            ` (${inside.report_conditions.map((c) => `${c.experiment_id} ${c.test_id}`).join(", ")})`}
          .
        </p>
      )}
      {view.nearest_outside_zone && (
        <>
          <p>Closest outside the zone:</p>
          <ul>
            {view.nearest_outside_zone.map((e) => (
              <Entry key={`${e.experiment_id}:${e.test_id}`} entry={e} gaps={zoneGaps(e)} />
            ))}
          </ul>
        </>
      )}
      {view.nearest_tests_by_experiment && (
        <>
          <p>Nearest tests to {target}:</p>
          <ul>
            {view.nearest_tests_by_experiment.map((e) => (
              <Entry key={`${e.experiment_id}:${e.test_id}`} entry={e} gaps={pointGaps(e, target)} />
            ))}
          </ul>
        </>
      )}
      <p data-testid="burner-note">
        Not on this map: {plural(view.burner_points_hidden, "burner point")}. Inverse flames report burner oxygen, not the
        oxygen of the room, so they never share this map.
      </p>
      <p data-testid="without-conditions">
        No per-test oxygen and pressure in the tables loaded: {view.experiments_without_conditions.join(", ")}.
      </p>
      <p>
        <small>Data version {snapshot.data_version}. Summary computed from data/clean and data/reference.</small>
      </p>
    </div>
  );
}
