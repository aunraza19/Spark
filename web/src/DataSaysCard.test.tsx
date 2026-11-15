import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataSaysCard } from "./DataSaysCard";
import { customSummary, lunarSummary } from "./fixtures";

describe("DataSaysCard", () => {
  it("has the heading What the data says here", () => {
    render(<DataSaysCard summary={lunarSummary} />);
    expect(screen.getByRole("heading", { name: "What the data says here" })).toBeInTheDocument();
  });

  it("shows each lead sentence on its own line, in order", () => {
    render(<DataSaysCard summary={customSummary} />);
    const lines = screen.getAllByTestId("lead-line").map((p) => p.textContent);
    expect(lines).toEqual(customSummary.lead);
  });

  it("keeps the lead sentences outside the evidence control", () => {
    render(<DataSaysCard summary={lunarSummary} />);
    for (const line of screen.getAllByTestId("lead-line")) expect(line.closest("details")).toBeNull();
  });

  it("puts its children behind Show the evidence", () => {
    render(
      <DataSaysCard summary={lunarSummary}>
        <p>the table</p>
      </DataSaysCard>,
    );
    const details = screen.getByText("Show the evidence").closest("details") as HTMLElement;
    expect(within(details).getByText("the table")).toBeInTheDocument();
  });

  it("shows no lead sentences while the summary is missing, but keeps the evidence", () => {
    render(
      <DataSaysCard summary={null}>
        <p>the table</p>
      </DataSaysCard>,
    );
    expect(screen.queryAllByTestId("lead-line")).toHaveLength(0);
    expect(screen.getByText("the table")).toBeInTheDocument();
  });
});
