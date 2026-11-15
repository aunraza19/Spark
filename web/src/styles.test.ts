import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

describe("styles", () => {
  it.each([
    "--color-paper",
    "--color-ink",
    "--color-graphite",
    "--color-flame",
    "--color-amber",
    "--color-lunar",
    "--color-zone",
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
