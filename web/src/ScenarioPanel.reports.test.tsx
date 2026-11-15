import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { scenarioSnapshot } from "./fixtures";
import { ScenarioPanel } from "./ScenarioPanel";

const withCounts = (tests: number, reports: number) => ({
  ...scenarioSnapshot,
  view: { ...scenarioSnapshot.view, tests_at_target: tests, report_conditions_at_target: reports },
});

const line = () => screen.getByTestId("scenario-at-target");

describe("report conditions at the target are not tests", () => {
  it.each([
    [0, 1, "1 condition from a NASA report matches this target exactly."],
    [0, 3, "3 conditions from a NASA report match this target exactly."],
  ])("with %s tests and %s report conditions it says: %s", (tests, reports, text) => {
    render(<ScenarioPanel snapshot={withCounts(tests, reports)} />);
    expect(line()).toHaveTextContent(text);
    expect(line()).not.toHaveTextContent(/\btests?\b/);
  });

  it("says both when there are both, tests first", () => {
    render(<ScenarioPanel snapshot={withCounts(2, 1)} />);
    expect(line()).toHaveTextContent("2 tests were run at exactly this condition. 1 condition from a NASA report matches this target exactly.");
  });

  it("keeps the sentence for tests alone, and for none", () => {
    const { unmount } = render(<ScenarioPanel snapshot={withCounts(1, 0)} />);
    expect(line()).toHaveTextContent("1 test was run at exactly this condition.");
    unmount();
    render(<ScenarioPanel snapshot={withCounts(0, 0)} />);
    expect(line()).toHaveTextContent("No test was run at this condition.");
  });
});
