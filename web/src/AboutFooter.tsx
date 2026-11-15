import type { ReactNode } from "react";
import type { About } from "./api";

type Props = { about: About | null; failed?: boolean; children?: ReactNode };

export function AboutFooter({ about, failed, children }: Props) {
  return (
    <footer className="about">
      <h2>About the data</h2>
      {children}
      {failed && <p>The notes about the data could not be loaded.</p>}
      {!failed && !about && <p>Loading the notes about the data...</p>}
      {about && (
        <>
          <ul aria-label="Sources">
            {about.sources.map((source) => (
              <li key={source.label}>
                {source.label}: {source.count} ({[source.path, ...(source.files ?? [])].join("; ")})
              </li>
            ))}
          </ul>
          <p data-testid="about-rule">How close a test is to a target: {about.distance_rule}</p>
          <h3>Known data problems</h3>
          <ul aria-label="Known data problems">
            {about.known_problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p>
            <small>Data version {about.data_version}. Everything on this page is computed from the files above.</small>
          </p>
        </>
      )}
    </footer>
  );
}
