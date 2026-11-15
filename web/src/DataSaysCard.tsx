import type { ReactNode } from "react";
import type { BlockSpec, Summary } from "./api";
import { AskAgent } from "./AskAgent";
import { Evidence } from "./Evidence";

export function DataSaysCard({ summary, ask, children }: { summary: Summary | null; ask?: BlockSpec | null; children?: ReactNode }) {
  return (
    <section aria-labelledby="data-says-heading" className="data-says">
      <h3 id="data-says-heading">What the data says here</h3>
      {summary?.lead.map((line) => (
        <p key={line} data-testid="lead-line" className="lead-line">
          {line}
        </p>
      ))}
      {ask && <AskAgent block={ask} />}
      <Evidence>{children}</Evidence>
    </section>
  );
}
