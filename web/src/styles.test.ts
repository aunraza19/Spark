import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

describe("styles", () => {
  it.each([
    "--color-text",
    "--color-muted",
    "--color-surface",
    "--color-border",
    "--color-accent",
    "--color-zone",
    "--color-gas",
    "--color-liquid",
    "--color-solid",
    "--space-1",
    "--space-2",
    "--space-3",
  ])("defines the token %s on :root", (token) => {
    expect(css).toMatch(new RegExp(`:root\\s*{[^}]*${token}\\s*:`));
  });

  it("uses no gradients", () => {
    expect(css).not.toMatch(/gradient\(/);
  });
});
