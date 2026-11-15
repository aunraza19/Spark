import type { ReactNode } from "react";
import type { Summary } from "./api";
import { Evidence } from "./Evidence";

export function DataSaysCard({ summary, children }: { summary: Summary | null; children?: ReactNode }) {
  return (
    <section aria-labelledby="data-says-heading" className="data-says">
      <h3 id="data-says-heading">What the data says here</h3>
      {summary?.lead.map((line) => (
        <p key={line} data-testid="lead-line" className="lead-line">
          {line}
        </p>
      ))}
      <Evidence>{children}</Evidence>
    </section>
  );
}
