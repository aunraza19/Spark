import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

describe("page styles", () => {
  it("has no dark mode: the page is light only", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).toMatch(/color-scheme:\s*light/);
  });

  it("gives the animation stage one solid dark colour", () => {
    expect(css).toMatch(/--color-stage\s*:\s*#[0-9a-fA-F]{6}/);
    expect(css).toMatch(/background:\s*var\(--color-stage\)/);
  });

  it("defines one text font, Public Sans, with system fallbacks, and uses no other", () => {
    expect(css).toMatch(/--font-text\s*:[^;]*Public Sans[^;]*system-ui/);
    const families = [...css.matchAll(/font-family\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) expect(family).toBe("var(--font-text)");
  });

  it("shows a visible focus ring and respects reduced motion", () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("uses no gradients and no blur effects", () => {
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/backdrop-filter|blur\(/);
  });
});
