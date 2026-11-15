import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AtmosphereMap } from "./AtmosphereMap";
import { custom, far, gas, iss, liquid, lunar, report, reportFar, solid } from "./fixtures";
import { mapScales } from "./scale";

const points = [gas, liquid, solid, far];

describe("AtmosphereMap pressure views", () => {
  it("draws only the marks up to 20 psi in the zoomed view", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} view="zoomed" />);
    expect(screen.getAllByTestId("point")).toHaveLength(3);
  });

  it("draws every mark in the full view", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} view="full" />);
    expect(screen.getAllByTestId("point")).toHaveLength(4);
  });

  it("draws every mark when no view is given", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    expect(screen.getAllByTestId("point")).toHaveLength(4);
  });

  it("leaves out a report condition above 20 psi in the zoomed view only", () => {
    const { unmount } = render(
      <AtmosphereMap points={[]} reportConditions={[report, reportFar]} habitat={lunar} view="zoomed" />,
    );
    expect(screen.getAllByTestId("report-condition")).toHaveLength(1);
    unmount();
    render(<AtmosphereMap points={[]} reportConditions={[report, reportFar]} habitat={lunar} view="full" />);
    expect(screen.getAllByTestId("report-condition")).toHaveLength(2);
  });

  it("labels the pressure axis only up to 20 psi in the zoomed view", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} view="zoomed" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("80")).toBeNull();
  });

  it("labels the pressure axis up to 80 psi in the full view", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} view="full" />);
    expect(screen.getByText("80")).toBeInTheDocument();
  });

  it("draws the zone on the zoomed scale", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} view="zoomed" />);
    const zone = screen.getByTestId("zone");
    const { x, y } = mapScales("zoomed");
    expect(Number(zone.getAttribute("width"))).toBeCloseTo(x(10.2) - x(0));
    expect(Number(zone.getAttribute("height"))).toBeCloseTo(y(30) - y(45));
  });

  it("places marks on the zoomed scale", () => {
    render(<AtmosphereMap points={[liquid]} reportConditions={[]} habitat={null} view="zoomed" />);
    const mark = screen.getByTestId("point");
    const { x } = mapScales("zoomed");
    const square = mark.querySelector("rect")!;
    expect(Number(square.getAttribute("x"))).toBeCloseTo(x(10.332) - 4);
  });

  it("places the ISS and custom markers on the zoomed scale", () => {
    const { x } = mapScales("zoomed");
    const { unmount } = render(<AtmosphereMap points={[]} reportConditions={[]} habitat={iss} view="zoomed" />);
    expect(Number(screen.getByTestId("habitat-marker").getAttribute("data-x"))).toBeCloseTo(x(14.7));
    unmount();
    render(<AtmosphereMap points={[]} reportConditions={[]} habitat={custom} view="zoomed" />);
    expect(Number(screen.getByTestId("habitat-marker").getAttribute("data-x"))).toBeCloseTo(x(9));
  });
});
