import { describe, expect, it } from "vitest";
import { drawScene, drawViewfinder, dropG, ease, flamePoints } from "./flame";
import { makeRecorder, texts } from "./recorder";

describe("dropG", () => {
  it("holds 1 g for the first 700 ms, then falls to 0 by 3100 ms", () => {
    expect(dropG(0, false)).toBe(1);
    expect(dropG(700, false)).toBe(1);
    expect(dropG(3100, false)).toBe(0);
    expect(dropG(9000, false)).toBe(0);
  });

  it("falls steadily in between", () => {
    const samples = [800, 1200, 1600, 2000, 2400, 2800].map((t) => dropG(t, false));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThan(samples[i - 1]);
    expect(samples[0]).toBeLessThan(1);
    expect(samples.at(-1)).toBeGreaterThan(0);
  });

  it("stays at 0 g with reduced motion, so nothing moves", () => {
    expect(dropG(0, true)).toBe(0);
    expect(dropG(1500, true)).toBe(0);
  });
});

describe("ease", () => {
  it("maps 0 to 0, 1 to 1 and 0.5 to 0.5, slowly at the ends", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });
});

function size(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

describe("flamePoints", () => {
  it("is a round sphere at 0 g, as wide as it is tall and symmetric about its centre", () => {
    const points = flamePoints(100, 200, 40, 0, 0, 1);
    const { width, height } = size(points);
    expect(height / width).toBeCloseTo(1, 1);
    const half = points.length / 2;
    for (let i = 0; i < half; i++) {
      expect(points[i].x - 100).toBeCloseTo(100 - points[points.length - 1 - i].x);
    }
  });

  it("is a tall teardrop at 1 g, clearly taller than it is wide", () => {
    const { width, height } = size(flamePoints(100, 200, 40, 1, 0, 1));
    expect(height / width).toBeGreaterThan(1.3);
  });

  it("gets taller with the flicker factor", () => {
    expect(size(flamePoints(100, 200, 40, 1, 0, 1.05)).height).toBeGreaterThan(size(flamePoints(100, 200, 40, 1, 0, 1)).height);
  });
});

describe("drawScene", () => {
  it("labels the left flame 1 g and the right flame 1.00 g at the start of the drop", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 0, false);
    expect(texts(recorder)).toEqual(["1 g", "1.00 g"]);
  });

  it("labels the right flame about 0 g once the drop is over", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 4000, false);
    expect(texts(recorder)).toEqual(["1 g", "about 0 g"]);
  });

  it("uses flat colours only: no gradients are created or assigned", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 1500, false);
    expect(recorder.calls.some((c) => /gradient/i.test(c.name))).toBe(false);
    for (const set of recorder.sets) {
      if (set.name === "fillStyle" || set.name === "strokeStyle") expect(typeof set.value).toBe("string");
    }
  });

  it("draws the two flames and the two droplets", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 0, false);
    expect(recorder.calls.filter((c) => c.name === "fill").length).toBeGreaterThanOrEqual(2 * 3);
    expect(recorder.calls.filter((c) => c.name === "arc").length).toBeGreaterThanOrEqual(2);
  });

  it("does not move or flicker with reduced motion", () => {
    const first = makeRecorder();
    const second = makeRecorder();
    drawScene(first.ctx, 500, 400, 100, true);
    drawScene(second.ctx, 500, 400, 5000, true);
    expect(JSON.stringify(first.calls)).toBe(JSON.stringify(second.calls));
  });
});

describe("viewfinder", () => {
  const near = (value: number, edge: number) => Math.abs(value - edge) <= 40;

  it("draws four corner marks, each an L of two lines, in the corners of the frame", () => {
    const recorder = makeRecorder();
    drawViewfinder(recorder.ctx, 500, 400);
    const moves = recorder.calls.filter((c) => c.name === "moveTo");
    const lines = recorder.calls.filter((c) => c.name === "lineTo");
    expect(moves).toHaveLength(4);
    expect(lines).toHaveLength(8);
    expect(recorder.calls.filter((c) => c.name === "stroke")).toHaveLength(4);
    for (const call of [...moves, ...lines]) {
      const [x, y] = call.args as number[];
      expect(near(x, 0) || near(x, 500)).toBe(true);
      expect(near(y, 0) || near(y, 400)).toBe(true);
    }
  });

  it("is subtle: a thin line in a flat colour with at most half opacity", () => {
    const recorder = makeRecorder();
    drawViewfinder(recorder.ctx, 500, 400);
    const colour = recorder.sets.find((s) => s.name === "strokeStyle")?.value as string;
    expect(colour).toMatch(/^rgba\(\d+,\d+,\d+,0?\.\d+\)$/);
    expect(Number(/,(0?\.\d+)\)$/.exec(colour)?.[1])).toBeLessThanOrEqual(0.5);
    expect(recorder.sets.find((s) => s.name === "lineWidth")?.value).toBeLessThanOrEqual(1.5);
  });

  it("is part of every frame of the stage", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 0, false);
    expect(recorder.calls.filter((c) => c.name === "stroke").length).toBeGreaterThanOrEqual(6);
  });
});

describe("the stage text", () => {
  it("is set in Public Sans bold, the page font", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 0, false);
    const font = recorder.sets.find((s) => s.name === "font")?.value as string;
    expect(font).toContain("Public Sans");
    expect(font.startsWith("700 ")).toBe(true);
  });

  it("shows the 1 g and the 0 g flames as still frames with reduced motion", () => {
    const recorder = makeRecorder();
    drawScene(recorder.ctx, 500, 400, 0, true);
    expect(texts(recorder)).toEqual(["1 g", "about 0 g"]);
  });
});
