import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

const darkBlock = /@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/.exec(css)?.[1] ?? "";

describe("page styles", () => {
  it.each(["--color-text", "--color-bg", "--color-surface", "--color-border", "--color-accent", "--color-muted"])(
    "changes %s in dark mode",
    (token) => {
      expect(darkBlock).toMatch(new RegExp(`${token}\\s*:`));
    },
  );

  it("gives the animation stage one solid dark colour", () => {
    expect(css).toMatch(/--color-stage\s*:\s*#[0-9a-fA-F]{6}/);
    expect(css).toMatch(/background:\s*var\(--color-stage\)/);
  });

  it("defines a display font and a text font with system fallbacks", () => {
    expect(css).toMatch(/--font-display\s*:[^;]*Bricolage Grotesque[^;]*system-ui/);
    expect(css).toMatch(/--font-text\s*:[^;]*Instrument Sans[^;]*system-ui/);
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
