import { describe, expect, it } from "vitest";
import { custom, far, gas, iss, liquid, lunar, ranged, report, reportFar, solid } from "./fixtures";
import { hiddenCounts, isVisible, needsFullRange, viewNote } from "./view";

describe("hiddenCounts", () => {
  it("counts the test points and report conditions above 20 psi in the zoomed view", () => {
    expect(hiddenCounts([gas, liquid, solid, far], [report, reportFar], "zoomed")).toEqual({ points: 1, reports: 1 });
  });

  it("hides nothing in the full view", () => {
    expect(hiddenCounts([gas, far], [reportFar], "full")).toEqual({ points: 0, reports: 0 });
  });

  it("keeps a point at exactly 20 psi and hides one just above", () => {
    const at20 = { ...gas, pressure_psi_min: 20, pressure_psi_max: 20 };
    const above = { ...gas, pressure_psi_min: 20.001, pressure_psi_max: 20.001 };
    expect(hiddenCounts([at20], [], "zoomed").points).toBe(0);
    expect(hiddenCounts([above], [], "zoomed").points).toBe(1);
  });

  it("hides a range that reaches above 20 psi, so no mark is half drawn", () => {
    const straddling = { ...ranged, pressure_psi_min: 19.9, pressure_psi_max: 20.1 };
    expect(hiddenCounts([straddling], [], "zoomed").points).toBe(1);
  });
});

describe("isVisible", () => {
  it.each([
    [20, "zoomed", true],
    [20.01, "zoomed", false],
    [73.5, "full", true],
  ] as const)("a mark up to %s psi in the %s view: %s", (psi, view, expected) => {
    expect(isVisible(psi, view)).toBe(expected);
  });
});

describe("needsFullRange", () => {
  it("is true for a custom target above 20 psi", () => {
    expect(needsFullRange({ ...custom, pressure_psi: 30 })).toBe(true);
  });

  it.each([
    ["a custom target at 20 psi", { ...custom, pressure_psi: 20 }],
    ["a custom target at 9 psi", custom],
    ["the ISS", iss],
    ["the lunar zone", lunar],
    ["no habitat", null],
  ])("is false for %s", (_name, habitat) => {
    expect(needsFullRange(habitat)).toBe(false);
  });
});

describe("viewNote", () => {
  it("says what range is shown and how many test points are not shown, with the number from the data", () => {
    const note = viewNote({ points: 689, reports: 0 }, "zoomed", false);
    expect(note).toContain("Showing 0 to 20 psi.");
    expect(note).toContain("689 test points above 20 psi are not shown");
  });

  it("uses the singular for one", () => {
    expect(viewNote({ points: 1, reports: 0 }, "zoomed", false)).toContain("1 test point above 20 psi is not shown");
  });

  it("counts report conditions the same way", () => {
    expect(viewNote({ points: 3, reports: 1 }, "zoomed", false)).toContain("1 report condition above 20 psi is not shown");
    expect(viewNote({ points: 3, reports: 2 }, "zoomed", false)).toContain("2 report conditions above 20 psi are not shown");
  });

  it("does not mention report conditions when none are hidden", () => {
    expect(viewNote({ points: 3, reports: 0 }, "zoomed", false)).not.toContain("report condition");
  });

  it("says plainly when nothing is hidden", () => {
    expect(viewNote({ points: 0, reports: 0 }, "zoomed", false)).toContain("No test points above 20 psi are hidden");
  });

  it("names the full range when everything is shown", () => {
    expect(viewNote({ points: 0, reports: 0 }, "full", false)).toBe("Showing the full range, 0 to 80 psi.");
  });

  it("gives the reason when the full range was chosen automatically", () => {
    expect(viewNote({ points: 0, reports: 0 }, "full", true)).toBe(
      "Showing the full range, 0 to 80 psi, because your target is above 20 psi.",
    );
  });
});
