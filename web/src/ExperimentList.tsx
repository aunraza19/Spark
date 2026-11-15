import { useEffect, useState } from "react";
import { fetchExperimentList, type ExperimentRow } from "./api";
import { BackLink } from "./BackLink";
import { experimentHref } from "./route";

export function ExperimentList() {
  const [rows, setRows] = useState<ExperimentRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchExperimentList()
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="page">
      <BackLink />
      <h1 className="page-title">All experiments</h1>
      {failed && <p>The list of experiments could not be loaded.</p>}
      {!failed && !rows && <p>Loading the experiments...</p>}
      {rows && (
        <>
          <p>
            {rows.length} experiment{rows.length === 1 ? "" : "s"} in the PSI data loaded.
          </p>
          <table className="experiments">
            <thead>
              <tr>
                <th>Experiment</th>
                <th>What was burned</th>
                <th>Tests or report conditions on the map</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.psi_id}>
                  <td>
                    <a href={experimentHref(row.psi_id)}>{row.name}</a>
                    <br />
                    <span className="note">{row.psi_id}</span>
                    {row.kind === "ground" && <span className="note"> Ground study</span>}
                  </td>
                  <td>{row.fuel_type}</td>
                  <td>{row.tests_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
