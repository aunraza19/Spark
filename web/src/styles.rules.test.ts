import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

const SIX = { paper: "#ffffff", ink: "#000000", graphite: "#595959", flame: "#0b5cad", amber: "#b45f00", lunar: "#2e7d5b" };
const SIZES = { s: "0.875rem", m: "1rem", l: "1.25rem", xl: "1.75rem", xxl: "3rem" };
const SPACES = ["4px", "8px", "16px", "24px", "40px", "64px"];

const declarations = (property: string) =>
  [...css.matchAll(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "g"))].map((m) => m[1].trim().replace(/\s*!important$/, ""));

const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector: string): string {
  const bodies: string[] = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].split(",").some((s) => s.trim() === selector)) bodies.push(match[2]);
  }
  return bodies.join("\n");
}

describe("colour: six named values, used for meaning", () => {
  it.each(Object.entries(SIX))("defines --color-%s as %s", (name, hex) => {
    expect(css.toLowerCase()).toContain(`--color-${name}: ${hex}`);
  });

  it("uses no hex colour outside the six", () => {
    const found = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(found.length).toBeGreaterThan(0);
    for (const hex of found) expect(Object.values(SIX)).toContain(hex);
  });

  it("makes lighter tints from the six with color-mix, never rgb() or hsl()", () => {
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  it("makes the stage pure Ink", () => {
    expect(css.toLowerCase()).toMatch(/--color-stage:\s*#000000/);
  });

  it("draws gas and liquid in Flame blue, solid as opaque Ink, reports in Amber and the zone in Lunar green", () => {
    expect(rule(".mark-gas")).toContain("var(--color-flame)");
    expect(rule(".mark-liquid")).toContain("var(--color-flame)");
    expect(rule(".mark-solid")).toContain("fill: var(--color-ink)");
    expect(rule(".mark-solid")).toContain("fill-opacity: 1");
    expect(rule(".mark-report polygon")).toContain("var(--color-amber)");
    expect(rule(".zone")).toContain("var(--color-lunar)");
  });

  it("uses an Ink focus ring, because blue is taken", () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:[^;}]*var\(--color-ink\)/);
  });
});

describe("type: one family, five sizes", () => {
  it.each(Object.entries(SIZES))("defines --text-%s as %s", (name, size) => {
    expect(css).toContain(`--text-${name}: ${size}`);
  });

  it("defines no other --text size", () => {
    const names = [...css.matchAll(/--text-([a-z]+)\s*:/g)].map((m) => m[1]);
    expect([...new Set(names)].sort()).toEqual(Object.keys(SIZES).sort());
  });

  it("sets every font size from those tokens, and never with the font shorthand", () => {
    const sizes = declarations("font-size");
    expect(sizes.length).toBeGreaterThan(5);
    for (const size of sizes) expect(size).toMatch(/^var\(--text-(s|m|l|xl|xxl)\)$/);
    expect(declarations("font")).toEqual([]);
  });

  it("uses only two weights, 400 and 700", () => {
    for (const weight of declarations("font-weight")) expect(["400", "700"]).toContain(weight);
  });

  it("keeps text lines to 66 characters", () => {
    expect(css).toMatch(/max-width:\s*66ch/);
  });

  it("lines figures up in tables and on the chart", () => {
    expect(rule("table")).toContain("tabular-nums");
    expect(rule(".tick text")).toContain("tabular-nums");
  });

  it("never changes case or letter spacing", () => {
    expect(css).not.toMatch(/text-transform/);
    expect(css).not.toMatch(/letter-spacing/);
    expect(css).not.toMatch(/font-variant(-caps)?\s*:\s*[^;]*caps/);
  });
});

describe("space, corners and effects", () => {
  it.each(SPACES.map((px, i) => [i + 1, px]))("defines --space-%i as %s", (n, px) => {
    expect(css).toContain(`--space-${n}: ${px}`);
  });

  it("sets padding, margin and gaps from the space tokens only", () => {
    for (const property of ["padding", "margin", "gap", "row-gap", "column-gap"]) {
      for (const value of declarations(property)) {
        for (const part of value.split(/\s+/)) expect(part).toMatch(/^(0|auto|var\(--space-[1-6]\))$/);
      }
    }
  });

  it("has square corners, or 2 px on controls", () => {
    const radii = declarations("border-radius");
    expect(radii.length).toBeGreaterThan(0);
    for (const radius of radii) expect(radius).toMatch(/^(0|var\(--radius\))$/);
    expect(css).toContain("--radius: 2px");
  });

  it("has no shadows, no text shadows and no filters", () => {
    expect(css).not.toMatch(/box-shadow|text-shadow|filter\s*:/);
  });

  it("has no animation and no transitions", () => {
    expect(css).not.toMatch(/@keyframes/);
    for (const value of [...declarations("transition"), ...declarations("animation")]) expect(value).toBe("none");
  });
});
