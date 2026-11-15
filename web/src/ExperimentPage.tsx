import { useEffect, useState } from "react";
import { ApiError, fetchExperimentPage, type ExperimentPageData } from "./api";
import { useRegisterView } from "./AgentChat";
import { AskAgent } from "./AskAgent";
import { BackLink } from "./BackLink";
import { RECORD_LABEL } from "./content";
import { Evidence } from "./Evidence";
import { formatRange } from "./format";

const SHOWN_RESULTS = 3;

function List({ title, items }: { title: string; items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

function Details({ page }: { page: ExperimentPageData }) {
  const { evidence } = page;
  const { conditions } = evidence;
  return (
    <Evidence>
      <List title="More key results from the record" items={page.key_results.slice(SHOWN_RESULTS)} />
      <h3>Conditions</h3>
      <p>Tests on the map: {conditions.tests_on_map || "none"}.</p>
      {conditions.report_conditions_on_map > 0 && <p>Conditions from a NASA report: {conditions.report_conditions_on_map}.</p>}
      {conditions.ranges && (
        <p>
          Oxygen on the map: {formatRange(...conditions.ranges.o2_pct)} %. Pressure on the map: {formatRange(...conditions.ranges.pressure_psi)} psi.
        </p>
      )}
      {conditions.source_files.length > 0 && <p>Source: {conditions.source_files.join("; ")}.</p>}
      <p className="evidence-label">What the record says about conditions:</p>
      <p>{conditions.record_note}</p>
      <List title="What was burned, from the record" items={evidence.fuels} />
      <List title="Sensors" items={evidence.sensors} />
      {evidence.publications.length > 0 && (
        <>
          <h3>Publications</h3>
          <ul>
            {evidence.publications.map((p) => (
              <li key={p.title}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>
                ) : (
                  p.title
                )}
                {p.authors ? `, ${p.authors}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      <List title="Data-quality notes" items={evidence.data_quality_notes} />
      <h3>Sources</h3>
      <p>Record: {evidence.record_file}.</p>
      {evidence.report_files.length > 0 && <p>Reports: {evidence.report_files.join("; ")}.</p>}
    </Evidence>
  );
}

export function ExperimentPage({ id }: { id: string }) {
  useRegisterView({ kind: "experiment", experiment_id: id });
  const [page, setPage] = useState<ExperimentPageData | null>(null);
  const [problem, setProblem] = useState<"missing" | "failed" | null>(null);

  useEffect(() => {
    setPage(null);
    setProblem(null);
    let current = true;
    fetchExperimentPage(id)
      .then((result) => current && setPage(result))
      .catch((error) => current && setProblem(error instanceof ApiError && error.status === 404 ? "missing" : "failed"));
    return () => {
      current = false;
    };
  }, [id]);

  return (
    <main className="page">
      <BackLink />
      {problem === "missing" && <p>No experiment with the id {id} in the data loaded.</p>}
      {problem === "failed" && <p>The experiment could not be loaded.</p>}
      {!problem && !page && <p>Loading the experiment...</p>}
      {page && (
        <article>
          <h1 className="page-title">{page.title}</h1>
          {page.acronym && <p className="full-name">{page.name}</p>}
          {page.lead.map((line) => (
            <p key={line} data-testid="lead-line" className="lead-line">
              {line}
            </p>
          ))}
          <AskAgent block={{ kind: "experiment", experiment_id: page.psi_id }} />
          <h2>Key results</h2>
          <p className="evidence-label">{RECORD_LABEL}</p>
          {page.key_results.length === 0 ? (
            <p>The record lists no key results.</p>
          ) : (
            <ul>
              {page.key_results.slice(0, SHOWN_RESULTS).map((result) => (
                <li key={result}>{result}</li>
              ))}
            </ul>
          )}
          <Details page={page} />
        </article>
      )}
    </main>
  );
}
