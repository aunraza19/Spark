import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { fetchPointCard, type CardRequest, type PointCard as Card } from "./api";
import { Evidence } from "./Evidence";

function Sources({ evidence }: { evidence: Card["evidence"] }) {
  const where =
    evidence.source_row === null
      ? `${evidence.source_file}, page ${evidence.page}, ${evidence.figure}`
      : `${evidence.source_file}, row ${evidence.source_row}`;
  return (
    <>
      <p>
        Experiment {evidence.experiment_id}
        {evidence.test_id ? `, test ${evidence.test_id}` : ""}.
      </p>
      <p>Source: {where}.</p>
      {evidence.pressure_note && <p>{evidence.pressure_note}</p>}
    </>
  );
}

export function PointCard({ request, onClose }: { request: CardRequest; onClose: () => void }) {
  const [card, setCard] = useState<Card | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const [opener] = useState(() => document.activeElement as HTMLElement | SVGElement | null);

  useEffect(() => {
    root.current?.focus();
    let current = true;
    fetchPointCard(request)
      .then((result) => current && setCard(result))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [request]);

  const close = () => {
    onClose();
    opener?.focus();
  };

  return (
    <section
      ref={root}
      aria-label="Test details"
      tabIndex={-1}
      className="point-card"
      onKeyDown={(event: KeyboardEvent) => event.key === "Escape" && close()}
    >
      <button type="button" className="button close" onClick={close}>
        Close
      </button>
      {failed ? (
        <p>The details of this test could not be loaded.</p>
      ) : !card ? (
        <p>Loading the details...</p>
      ) : (
        <>
          <h3>{card.title}</h3>
          <dl className="card-facts">
            <dt>What was burned</dt>
            <dd>{card.burned}</dd>
            <dt>Conditions</dt>
            <dd>{card.conditions}</dd>
            <dt>What happened</dt>
            <dd>{card.result}</dd>
          </dl>
          <Evidence>
            <Sources evidence={card.evidence} />
          </Evidence>
        </>
      )}
    </section>
  );
}
