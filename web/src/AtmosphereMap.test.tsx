import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AtmosphereMap } from "./AtmosphereMap";
import { custom, gas, iss, liquid, lunar, ranged, report, solid, unrounded } from "./fixtures";
import { MAP, mapScales } from "./scale";

const points = [gas, liquid, solid, ranged];
const titleOf = (element: Element) => element.querySelector("title")?.textContent ?? "";

describe("AtmosphereMap", () => {
  it("draws one mark per ambient test point", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    expect(screen.getAllByTestId("point")).toHaveLength(4);
  });

  it("draws every point, even when two share the same position", () => {
    render(<AtmosphereMap points={[solid, { ...solid, test_id: "B2", source_row: 3 }]} reportConditions={[]} habitat={null} />);
    expect(screen.getAllByTestId("point")).toHaveLength(2);
  });

  it("draws one marker per report condition and says it is from a report", () => {
    render(<AtmosphereMap points={points} reportConditions={[report]} habitat={lunar} />);
    const markers = screen.getAllByTestId("report-condition");
    expect(markers).toHaveLength(1);
    const title = titleOf(markers[0]);
    expect(title).toContain("from report");
    expect(title).toContain("PSI-20");
    expect(title).toContain("19070D1");
    expect(title).toContain("BRE_final_report_20220201.pdf, page 26, Figure 9");
  });

  it("shades the lunar zone from 0 psi to its pressure limit and from its oxygen limit to the top", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    const zone = screen.getByTestId("zone");
    const { x, y } = mapScales();
    expect(zone.getAttribute("data-o2-min")).toBe("30");
    expect(zone.getAttribute("data-psi-max")).toBe("10.2");
    expect(Number(zone.getAttribute("x"))).toBeCloseTo(x(0));
    expect(Number(zone.getAttribute("width"))).toBeCloseTo(x(10.2) - x(0));
    expect(Number(zone.getAttribute("y"))).toBeCloseTo(y(45));
    expect(Number(zone.getAttribute("height"))).toBeCloseTo(y(30) - y(45));
  });

  it("shows no zone for a point habitat, and marks the ISS point", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={iss} />);
    expect(screen.queryByTestId("zone")).toBeNull();
    const marker = screen.getByTestId("habitat-marker");
    const { x, y } = mapScales();
    expect(Number(marker.getAttribute("data-x"))).toBeCloseTo(x(14.7));
    expect(Number(marker.getAttribute("data-y"))).toBeCloseTo(y(21));
    expect(titleOf(marker)).toContain("ISS cabin");
  });

  it("marks a custom target at the numbers the user entered", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={custom} />);
    const marker = screen.getByTestId("habitat-marker");
    const { x, y } = mapScales();
    expect(Number(marker.getAttribute("data-x"))).toBeCloseTo(x(9));
    expect(Number(marker.getAttribute("data-y"))).toBeCloseTo(y(28));
  });

  it("draws gas as a circle, liquid as a square and solid as a triangle", () => {
    render(<AtmosphereMap points={[gas, liquid, solid]} reportConditions={[]} habitat={lunar} />);
    const byFuel = (fuel: string) => screen.getAllByTestId("point").find((p) => p.getAttribute("data-fuel-state") === fuel)!;
    expect(byFuel("gas").querySelector("circle")).not.toBeNull();
    expect(byFuel("liquid").querySelector("rect")).not.toBeNull();
    expect(byFuel("solid").querySelector("polygon")).not.toBeNull();
  });

  it("names the source file and row of every point on hover", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    const marks = screen.getAllByTestId("point");
    expect(titleOf(marks[1])).toContain("PSI-69");
    expect(titleOf(marks[1])).toContain("test 37");
    expect(titleOf(marks[1])).toContain("PSI-69_Experimental table_FLEX.csv, row 38");
  });

  it("says when the pressure came from the experiment record", () => {
    render(<AtmosphereMap points={[solid, liquid]} reportConditions={[]} habitat={lunar} />);
    const [fromRecord, fromTable] = screen.getAllByTestId("point");
    expect(titleOf(fromRecord)).toContain("pressure from the experiment record");
    expect(titleOf(fromTable)).not.toContain("pressure from the experiment record");
  });

  it("shows numbers rounded for display only", () => {
    render(<AtmosphereMap points={[unrounded]} reportConditions={[]} habitat={null} />);
    const title = titleOf(screen.getByTestId("point"));
    expect(title).toContain("20.71 % oxygen");
    expect(title).toContain("14.87 psi");
    expect(title).not.toContain("20.7128374");
  });

  it("draws a range as a bar over the whole range, not as one point in the middle", () => {
    render(<AtmosphereMap points={[ranged]} reportConditions={[]} habitat={null} />);
    const mark = screen.getByTestId("point");
    const { x } = mapScales();
    const bar = mark.querySelector("rect")!;
    expect(bar.getAttribute("data-ranged")).toBe("true");
    expect(Number(bar.getAttribute("width"))).toBeCloseTo(x(14.54) - x(14.47) + 2 * MAP.markRadius);
    expect(titleOf(mark)).toContain("21.5 to 21.7 % oxygen");
  });

  it("labels both axes with units", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    expect(screen.getByText("Pressure (psi)")).toBeInTheDocument();
    expect(screen.getByText("Oxygen (% by volume)")).toBeInTheDocument();
  });

  it("has a legend for the three fuel states, the report condition and the zone", () => {
    render(<AtmosphereMap points={points} reportConditions={[report]} habitat={lunar} />);
    const legend = within(screen.getByRole("list", { name: "Legend" }));
    for (const label of ["Gas", "Liquid", "Solid", "Report condition", "Target zone"]) {
      expect(legend.getByText(new RegExp(label))).toBeInTheDocument();
    }
  });

  it("describes the chart for screen readers", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    expect(screen.getByRole("img", { name: /oxygen against pressure/i })).toBeInTheDocument();
  });
});
