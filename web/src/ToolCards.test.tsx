import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { GetExperimentCard, QueryTestsCard } from "./ToolCards";

const done = { type: "complete" } as never;
const running = { type: "running" } as never;
const props = (overrides: object) =>
  ({ toolCallId: "c", toolName: "x", argsText: "{}", args: {}, status: done, ...overrides }) as unknown as ComponentProps<typeof QueryTestsCard>;

const counted = {
  filter: { zone: "lunar", fuel_state: "gas" },
  count: 20,
  by_experiment: { "PSI-159": 20 },
  source: "data/clean/test_points.json (ambient test points only)",
};

describe("QueryTestsCard", () => {
  it("shows the count, what was asked, the experiments and the source", () => {
    render(<QueryTestsCard {...props({ args: { zone: "lunar", fuel_state: "gas" }, result: counted })} />);
    const card = screen.getByTestId("tool-card");
    expect(card).toHaveTextContent("20 tests");
    expect(card).toHaveTextContent("Asked for: zone lunar, fuel state gas");
    expect(within(card).getByRole("link", { name: "PSI-159" })).toHaveAttribute("href", "#experiment/PSI-159");
    expect(card).toHaveTextContent("Source: data/clean/test_points.json (ambient test points only)");
  });

  it("reads a result that arrives as a JSON string", () => {
    render(<QueryTestsCard {...props({ result: JSON.stringify(counted) })} />);
    expect(screen.getByTestId("tool-card")).toHaveTextContent("20 tests");
  });

  it("says 1 test for one", () => {
    render(<QueryTestsCard {...props({ result: { ...counted, count: 1, by_experiment: { "PSI-25": 1 } } })} />);
    expect(screen.getByTestId("tool-card")).toHaveTextContent("1 test");
    expect(screen.getByTestId("tool-card")).not.toHaveTextContent("1 tests");
  });

  it("says it is counting while the tool runs", () => {
    render(<QueryTestsCard {...props({ status: running, result: undefined })} />);
    expect(screen.getByTestId("tool-card")).toHaveTextContent("Counting tests...");
  });

  it("says in plain words when the tool could not answer", () => {
    render(<QueryTestsCard {...props({ result: { error: "unknown filter: surprise" } })} />);
    expect(screen.getByTestId("tool-card")).toHaveTextContent("The tool could not answer: unknown filter: surprise");
  });
});

describe("GetExperimentCard", () => {
  const experiment = {
    title: "BASS-II (PSI-25)",
    lead: ["It burned solid material.", "It ran on the ISS."],
    key_results: ["PMMA rods stay flammable."],
    conditions: { tests_on_map: 129 },
  };

  it("shows the experiment as a link to its page with its plain sentences", () => {
    render(<GetExperimentCard {...props({ args: { psi_id: "PSI-25" }, result: experiment })} />);
    const card = screen.getByTestId("tool-card");
    expect(within(card).getByRole("link", { name: "BASS-II (PSI-25)" })).toHaveAttribute("href", "#experiment/PSI-25");
    expect(card).toHaveTextContent("It burned solid material.");
    expect(card).toHaveTextContent("It ran on the ISS.");
  });

  it("says it is reading the record while the tool runs", () => {
    render(<GetExperimentCard {...props({ status: running, result: undefined })} />);
    expect(screen.getByTestId("tool-card")).toHaveTextContent("Reading the experiment record...");
  });

  it("says so when there is no such experiment", () => {
    render(<GetExperimentCard {...props({ args: { psi_id: "PSI-999" }, result: { error: "unknown experiment" } })} />);
    expect(screen.getByTestId("tool-card")).toHaveTextContent("The tool could not answer: unknown experiment");
  });
});
