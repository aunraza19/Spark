import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lunarSnapshot } from "./fixtures";
import { MapSummary } from "./MapSummary";

describe("MapSummary view note", () => {
  it("shows the note about the pressure range when one is given", () => {
    render(<MapSummary snapshot={lunarSnapshot} viewNote="Showing 0 to 20 psi. 1 test point above 20 psi is not shown." />);
    expect(screen.getByTestId("summary-view-note")).toHaveTextContent("1 test point above 20 psi is not shown");
  });

  it("shows no note when none is given", () => {
    render(<MapSummary snapshot={lunarSnapshot} />);
    expect(screen.queryByTestId("summary-view-note")).toBeNull();
  });
});
