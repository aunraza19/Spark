import type { BlockSpec, ScenarioSnapshot, SnapshotEntry } from "./api";
import { AskAgent } from "./AskAgent";
import { formatNumber } from "./format";

const signed = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value));

function atTarget(count: number): string {
  if (count === 0) return "No test was run at this condition.";
  return `${count} test${count === 1 ? " was" : "s were"} run at exactly this condition.`;
}

function Row({ entry }: { entry: SnapshotEntry }) {
  const report = entry.basis === "report";
  return (
    <tr data-testid="scenario-row">
      <td>{entry.experiment_id}</td>
      <td>{entry.test_id}{report ? " (from report)" : ""}</td>
      <td>{formatNumber(entry.o2_pct)}</td>
      <td>{formatNumber(entry.pressure_psi)}</td>
      <td>{signed(entry.gap_o2_pct_points)}</td>
      <td>{signed(entry.gap_psi)}</td>
      <td>{formatNumber(entry.distance)}</td>
      <td>{report ? `${entry.source_file} (report)` : `${entry.source_file}, row ${entry.source_row}`}</td>
    </tr>
  );
}

export function ScenarioPanel({ snapshot, failed, ask }: { snapshot: ScenarioSnapshot | null; failed?: boolean; ask?: BlockSpec }) {
  return (
    <section aria-labelledby="scenario-heading" className="scenario">
      <h2 id="scenario-heading">Custom scenario</h2>
      {failed && <p role="alert" className="error">Could not load the scenario.</p>}
      {!failed && !snapshot && <p>Loading...</p>}
      {snapshot && (
        <>
          {ask && <AskAgent block={ask} />}
          <p data-testid="scenario-target">
            Your target: {formatNumber(snapshot.habitat.o2_pct)} % oxygen at {formatNumber(snapshot.habitat.pressure_psi)} psi.
          </p>
          <p data-testid="scenario-zone">
            This target is {snapshot.view.inside_lunar_zone ? "" : "not "}inside the lunar zone.
          </p>
          <p data-testid="scenario-at-target">{atTarget(snapshot.view.tests_at_target)}</p>
          <table>
            <caption>Nearest tests to your target</caption>
            <thead>
              <tr>
                <th>Experiment</th>
                <th>Test</th>
                <th>Oxygen (%)</th>
                <th>Pressure (psi)</th>
                <th>Oxygen gap (points)</th>
                <th>Pressure gap (psi)</th>
                <th>Distance</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.view.nearest_tests.map((entry) => (
                <Row key={`${entry.experiment_id}:${entry.test_id}`} entry={entry} />
              ))}
            </tbody>
          </table>
          <p data-testid="scenario-rule" className="note">How distance is measured: {snapshot.view.distance_rule}</p>
          <p><small>Data version {snapshot.data_version}. Computed from data/clean and data/reference.</small></p>
        </>
      )}
    </section>
  );
}
