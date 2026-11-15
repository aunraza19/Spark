import type { Summary } from "./api";

function Column({ id, title, lines }: { id: string; title: string; lines: string[] }) {
  return (
    <div className="know-column">
      <h3 id={id}>{title}</h3>
      {lines.length === 0 ? (
        <p>Nothing in the data for this choice.</p>
      ) : (
        <ul aria-labelledby={id}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KnowDontKnow({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  return (
    <section aria-labelledby="know-heading" className="know">
      <h2 id="know-heading">What we know, what we don't</h2>
      <div className="know-columns">
        <Column id="know-yes" title="What we know" lines={summary.know} />
        <Column id="know-no" title="What we don't know" lines={summary.dont_know} />
      </div>
    </section>
  );
}
