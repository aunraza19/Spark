import { THREE_LINES } from "./content";

export function ThreeLines() {
  return (
    <section aria-labelledby="three-lines-heading" className="three-lines">
      <h2 id="three-lines-heading">The question in three lines</h2>
      <dl>
        {THREE_LINES.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
