import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { customSnapshot, lunarSnapshot } from "./fixtures";
import { MapSummary } from "./MapSummary";

describe("MapSummary", () => {
  it("says it is loading when there is no snapshot yet", () => {
    render(<MapSummary snapshot={null} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("states how many tests and report conditions are inside the zone", () => {
    render(<MapSummary snapshot={lunarSnapshot} />);
    const inside = screen.getByTestId("inside-zone").textContent ?? "";
    expect(inside).toContain("20 test points");
    expect(inside).toContain("PSI-159: 20");
    expect(inside).toContain("1 report condition");
    expect(inside).toContain("PSI-20 19070D1");
  });

  it("lists the closest tests outside the zone with their gaps and sources", () => {
    render(<MapSummary snapshot={lunarSnapshot} />);
    const items = screen.getAllByTestId("nearest");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("PSI-69 test 37");
    expect(items[0].textContent).toContain("34 % oxygen at 10.33 psi");
    expect(items[0].textContent).toContain("0.13 psi above the limit");
    expect(items[0].textContent).toContain("PSI-69_Experimental table_FLEX.csv, row 38");
    expect(items[1].textContent).toContain("from report");
    expect(items[1].textContent).toContain("3 points of oxygen short");
    expect(items[1].textContent).toContain("BRE_final_report_20220201.pdf");
    expect(items[1].textContent).not.toContain("row");
  });

  it("says how many burner points are left off this map and why", () => {
    render(<MapSummary snapshot={lunarSnapshot} />);
    const text = screen.getByTestId("burner-note").textContent ?? "";
    expect(text).toContain("263 burner points");
    expect(text).toContain("burner oxygen");
  });

  it("lists the experiments that have no per-test conditions", () => {
    render(<MapSummary snapshot={lunarSnapshot} />);
    const text = screen.getByTestId("without-conditions").textContent ?? "";
    expect(text).toContain("PSI-21, PSI-22, PSI-47");
  });

  it("shows nearest tests for a point habitat and no zone block", () => {
    render(<MapSummary snapshot={customSnapshot} />);
    expect(screen.queryByTestId("inside-zone")).toBeNull();
    const item = screen.getByTestId("nearest");
    expect(item.textContent).toContain("PSI-20 test 19056F1");
    expect(item.textContent).toContain("1 point of oxygen below your target");
    expect(item.textContent).toContain("1.2 psi above your target");
    expect(screen.getByText(/Nearest tests to your target/)).toBeInTheDocument();
  });

  it("shows the data version so a reader can tie the text to the data", () => {
    render(<MapSummary snapshot={lunarSnapshot} />);
    expect(screen.getByText(/Data version 163e1fe25dcd/)).toBeInTheDocument();
  });
});
