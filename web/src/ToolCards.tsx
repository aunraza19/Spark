import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { experimentHref } from "./route";

function parse(result: unknown): Record<string, unknown> | null {
  if (result === undefined || result === null) return null;
  return (typeof result === "string" ? JSON.parse(result) : result) as Record<string, unknown>;
}

const asked = (args: unknown) => {
  const entries = Object.entries((args ?? {}) as Record<string, unknown>);
  return entries.length ? entries.map(([name, value]) => `${name.replaceAll("_", " ")} ${value}`).join(", ") : "every test";
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="tool-card" data-testid="tool-card">
      {children}
    </div>
  );
}

export const QueryTestsCard: ToolCallMessagePartComponent = ({ args, result }) => {
  const data = parse(result);
  if (!data) return <Card><p>Counting tests...</p></Card>;
  if (typeof data.error === "string") return <Card><p>The tool could not answer: {data.error}</p></Card>;
  const count = data.count as number;
  return (
    <Card>
      <p>
        <strong>
          {count} test{count === 1 ? "" : "s"}
        </strong>
      </p>
      <p>Asked for: {asked(args)}</p>
      <table>
        <tbody>
          {Object.entries((data.by_experiment ?? {}) as Record<string, number>).map(([id, n]) => (
            <tr key={id}>
              <td>
                <a href={experimentHref(id)}>{id}</a>
              </td>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Source: {String(data.source)}</p>
    </Card>
  );
};

export const GetExperimentCard: ToolCallMessagePartComponent = ({ args, result }) => {
  const data = parse(result);
  if (!data) return <Card><p>Reading the experiment record...</p></Card>;
  if (typeof data.error === "string") return <Card><p>The tool could not answer: {data.error}</p></Card>;
  const id = String((args as { psi_id?: string } | undefined)?.psi_id ?? "");
  return (
    <Card>
      <p>
        <a href={experimentHref(id)}>
          <strong>{String(data.title)}</strong>
        </a>
      </p>
      {(data.lead as string[]).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </Card>
  );
};
