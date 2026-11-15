import { Fragment, useEffect, useRef, useState } from "react";
import { fetchExplanation, type BlockSpec, type Explanation } from "./api";
import { experimentHref } from "./route";

export const AGENT_NOTE = "Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.";

const MESSAGES = {
  unchecked: "Spark agent could not give a checked explanation. Open Show the evidence instead.",
  busy: "Spark agent is busy. Try again in a minute.",
  unavailable: "Spark agent is not set up on this server.",
};

function Answer({ result }: { result: Extract<Explanation, { status: "ok" }> }) {
  const { answer } = result;
  return (
    <>
      <h4>What you are seeing</h4>
      <p>{answer.seeing}</p>
      <h4>What it means for fire safety</h4>
      <p>{answer.fire_safety}</p>
      <h4>What the data cannot tell you</h4>
      <p>{answer.cannot_tell}</p>
      <h4>Sources</h4>
      <p>
        {answer.sources.map((id, index) => (
          <Fragment key={id}>
            {index > 0 && ", "}
            <a href={experimentHref(id)}>{id}</a>
          </Fragment>
        ))}
      </p>
      <p className="agent-note">{AGENT_NOTE}</p>
    </>
  );
}

export function AskAgent({ block }: { block: BlockSpec }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Explanation | null>(null);
  const latest = useRef(0);
  const blockKey = JSON.stringify(block);

  useEffect(() => {
    latest.current += 1;
    setOpen(false);
    setResult(null);
  }, [blockKey]);

  const toggle = () => {
    if (open) {
      latest.current += 1;
      setOpen(false);
      return;
    }
    const mine = ++latest.current;
    setOpen(true);
    setResult(null);
    fetchExplanation(block).then((answer) => {
      if (latest.current === mine) setResult(answer);
    });
  };

  return (
    <div className="ask">
      <button type="button" className="button" aria-expanded={open} onClick={toggle}>
        Ask Spark agent
      </button>
      {open && (
        <div className="ask-panel" role="region" aria-label="Spark agent explanation" aria-live="polite">
          {!result && <p>Spark agent is reading this block.</p>}
          {result?.status === "ok" && <Answer result={result} />}
          {result && result.status !== "ok" && <p>{MESSAGES[result.status]}</p>}
        </div>
      )}
    </div>
  );
}
