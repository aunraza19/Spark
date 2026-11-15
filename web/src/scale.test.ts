import { describe, expect, it } from "vitest";
import { linearScale, MAP, mapScales } from "./scale";

describe("linearScale", () => {
  it("maps the ends and the middle of the domain onto the range", () => {
    const scale = linearScale([0, 80], [60, 620]);
    expect(scale(0)).toBe(60);
    expect(scale(80)).toBe(620);
    expect(scale(40)).toBe(340);
  });

  it("supports a reversed range, as an upward axis needs", () => {
    const scale = linearScale([0, 45], [352, 16]);
    expect(scale(0)).toBe(352);
    expect(scale(45)).toBe(16);
  });
});

describe("mapScales", () => {
  it("puts pressure 0 to 80 psi and oxygen 0 to 45 % inside the plot area", () => {
    const { x, y } = mapScales();
    expect(x(0)).toBe(MAP.margin.left);
    expect(x(80)).toBe(MAP.width - MAP.margin.right);
    expect(y(0)).toBe(MAP.height - MAP.margin.bottom);
    expect(y(45)).toBe(MAP.margin.top);
  });
});
