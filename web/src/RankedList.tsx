import { useEffect, useState } from "react";
import { fetchRanking, type RankingView, type Selection } from "./api";
import { Evidence } from "./Evidence";
import { experimentHref } from "./route";

function Table({ view }: { view: RankingView }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Experiment</th>
          <th>Atmosphere match</th>
          <th>Tests inside the zone</th>
          <th>Tests with oxygen and pressure</th>
          <th>Material relevance ({view.evidence.weighting_label})</th>
        </tr>
      </thead>
      <tbody>
        {view.rows.map((row) => (
          <tr key={row.psi_id}>
            <td>{row.rank}</td>
            <td>{row.title}</td>
            <td>{row.match}</td>
            <td>{row.tests_inside_zone ?? "not applicable"}</td>
            <td>{row.tests_with_conditions}</td>
            <td>{row.material_relevance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RankedList({ selection }: { selection: Selection }) {
  const [view, setView] = useState<RankingView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setView(null);
    setFailed(false);
    let current = true;
    fetchRanking(selection)
      .then((result) => current && setView(result))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [selection]);

  return (
    <section aria-labelledby="ranked-heading" className="ranked-list">
      <h3 id="ranked-heading">Experiments, closest first</h3>
      {failed && <p>The ranking could not be loaded.</p>}
      {!failed && !view && <p>Loading the ranking...</p>}
      {view && (
        <>
          {view.lead.map((line) => (
            <p key={line} data-testid="ranking-lead" className="lead-line">
              {line}
            </p>
          ))}
          <p className="note">Each bar shows how close the tests of an experiment came to this atmosphere.</p>
          <ol className="ranked">
            {view.rows.map((row) => (
              <li key={row.psi_id} data-testid="ranked-row">
                <span className="rank">{row.rank}</span>
                <span className="ranked-name">
                  <a href={experimentHref(row.psi_id)}>{row.title}</a>
                  <span className="note">{row.category}</span>
                </span>
                <div
                  className="bar"
                  role="meter"
                  aria-label="How close its tests came to this atmosphere"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={row.match}
                >
                  <span style={{ width: `${row.match}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <Evidence>
            <Table view={view} />
            <p>{view.evidence.distance_rule}</p>
            <p>{view.evidence.atmosphere_rule}</p>
            <p>{view.evidence.material_rule}</p>
            <p>{view.evidence.sort_rule}</p>
            <h3>Weights, {view.evidence.weighting_label}</h3>
            <ul>
              {Object.entries(view.evidence.weights).map(([label, weight]) => (
                <li key={label}>
                  {label}: {weight}
                </li>
              ))}
            </ul>
          </Evidence>
          <details className="not-scored">
            <summary>Experiments that could not be scored ({view.not_scored.length})</summary>
            <ul>
              {view.not_scored.map((row) => (
                <li key={row.psi_id}>
                  <a href={experimentHref(row.psi_id)}>{row.title}</a>: {row.reason}.
                </li>
              ))}
            </ul>
          </details>
          <p className="see-all">
            <a href="#experiments">See all {view.rows.length + view.not_scored.length} experiments</a>
          </p>
        </>
      )}
    </section>
  );
}
