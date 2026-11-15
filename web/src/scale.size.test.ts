import { describe, expect, it } from "vitest";
import { MAP, mapScales, mapSize } from "./scale";

describe("mapSize", () => {
  it("keeps the default drawing when the width is not known", () => {
    expect(mapSize(0)).toEqual({ width: MAP.width, height: MAP.height });
  });

  it("is as wide as its box, and half as tall on a wide screen", () => {
    expect(mapSize(1120)).toEqual({ width: 1120, height: 560 });
  });

  it("is taller than wide on a phone, 4 by 5", () => {
    expect(mapSize(358)).toEqual({ width: 358, height: 448 });
  });
});

describe("mapScales with a size", () => {
  it("fits the plot to the given size and keeps the margins", () => {
    const size = { width: 358, height: 448 };
    const { x, y } = mapScales("full", size);
    expect(x(0)).toBe(MAP.margin.left);
    expect(x(80)).toBe(size.width - MAP.margin.right);
    expect(y(0)).toBe(size.height - MAP.margin.bottom);
    expect(y(45)).toBe(MAP.margin.top);
  });
});
