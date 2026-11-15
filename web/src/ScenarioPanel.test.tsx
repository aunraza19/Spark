import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScenarioSnapshot } from "./api";
import { scenarioSnapshot } from "./fixtures";
import { ScenarioPanel } from "./ScenarioPanel";

function withView(changes: Partial<ScenarioSnapshot["view"]>): ScenarioSnapshot {
  return { ...scenarioSnapshot, view: { ...scenarioSnapshot.view, ...changes } };
}

describe("ScenarioPanel", () => {
  it("says it is loading when there is no snapshot yet", () => {
    render(<ScenarioPanel snapshot={null} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows a plain message when the scenario could not be loaded", () => {
    render(<ScenarioPanel snapshot={null} failed />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load the scenario.");
  });

  it("names the target from the snapshot", () => {
    render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    expect(screen.getByRole("heading", { level: 2, name: "Custom scenario" })).toBeInTheDocument();
    expect(screen.getByTestId("scenario-target")).toHaveTextContent("Your target: 28 % oxygen at 9 psi.");
  });

  it("says whether the target is inside the lunar zone", () => {
    const { unmount } = render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    expect(screen.getByTestId("scenario-zone")).toHaveTextContent("This target is not inside the lunar zone.");
    unmount();
    render(<ScenarioPanel snapshot={withView({ inside_lunar_zone: true })} />);
    expect(screen.getByTestId("scenario-zone")).toHaveTextContent("This target is inside the lunar zone.");
  });

  it.each([
    [0, "No test was run at this condition."],
    [1, "1 test was run at exactly this condition."],
    [3, "3 tests were run at exactly this condition."],
  ])("with %s tests at the target it says: %s", (count, text) => {
    render(<ScenarioPanel snapshot={withView({ tests_at_target: count })} />);
    expect(screen.getByTestId("scenario-at-target")).toHaveTextContent(text);
  });

  it("lists the nearest tests in a table with named columns", () => {
    render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "Experiment", "Test", "Oxygen (%)", "Pressure (psi)", "Oxygen gap (points)", "Pressure gap (psi)", "Distance", "Source",
    ]);
    expect(screen.getAllByTestId("scenario-row")).toHaveLength(5);
  });

  it("shows the gaps with their signs and the distance rounded for display", () => {
    render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    const cells = within(screen.getAllByTestId("scenario-row")[0]).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(0, 7)).toEqual(["PSI-20", "19056F1 (from report)", "27", "10.2", "-1", "+1.2", "0.14"]);
  });

  it("shows a gap of zero without a sign", () => {
    const snapshot = withView({
      nearest_tests: [{ ...scenarioSnapshot.view.nearest_tests[2], gap_o2_pct_points: 0, gap_psi: 0, distance: 0 }],
    });
    render(<ScenarioPanel snapshot={snapshot} />);
    const cells = within(screen.getByTestId("scenario-row")).getAllByRole("cell").map((c) => c.textContent);
    expect(cells.slice(4, 7)).toEqual(["0", "0", "0"]);
  });

  it("names the source of every row: the table row for a test, the file for a report condition", () => {
    render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    const rows = screen.getAllByTestId("scenario-row");
    expect(within(rows[0]).getAllByRole("cell")[7]).toHaveTextContent("BRE_final_report_20220201.pdf (report)");
    expect(within(rows[2]).getAllByRole("cell")[7]).toHaveTextContent("PSI-69_Experimental table_FLEX.csv, row 42");
  });

  it("states how distance is measured, using the rule text from the data", () => {
    render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    expect(screen.getByTestId("scenario-rule")).toHaveTextContent(scenarioSnapshot.view.distance_rule);
  });

  it("shows the data version", () => {
    render(<ScenarioPanel snapshot={scenarioSnapshot} />);
    expect(screen.getByText(/Data version 163e1fe25dcd/)).toBeInTheDocument();
  });
});
