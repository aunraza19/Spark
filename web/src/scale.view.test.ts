import { describe, expect, it } from "vitest";
import { MAP, mapScales, PRESSURE_VIEWS } from "./scale";

describe("pressure views", () => {
  it("are 0 to 20 psi zoomed and 0 to 80 psi full", () => {
    expect(PRESSURE_VIEWS.zoomed).toEqual([0, 20]);
    expect(PRESSURE_VIEWS.full).toEqual([0, 80]);
  });

  it("put the end of each view at the right edge of the plot area", () => {
    expect(mapScales("zoomed").x(0)).toBe(MAP.margin.left);
    expect(mapScales("zoomed").x(20)).toBe(MAP.width - MAP.margin.right);
    expect(mapScales("full").x(80)).toBe(MAP.width - MAP.margin.right);
  });

  it("stretches 10 psi across more of the plot in the zoomed view", () => {
    expect(mapScales("zoomed").x(10) - MAP.margin.left).toBeGreaterThan(mapScales("full").x(10) - MAP.margin.left);
  });

  it("uses the full view when no view is given", () => {
    expect(mapScales().x(80)).toBe(MAP.width - MAP.margin.right);
  });
});
