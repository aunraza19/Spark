import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";

const sources = import.meta.glob(["./*.ts", "./*.tsx", "!./*.test.ts", "!./*.test.tsx", "!./fixtures.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("the shipped copy", () => {
  it("reads the source files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(15);
    expect(Object.keys(sources)).toContain("./content.ts");
  });

  it("has no marketing words", () => {
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/\b(insights?|unlock\w*|powerful|seamless\w*|cutting-edge|AI-powered)\b/i);
    }
  });

  it("has no arrows and no middle dots in the text", () => {
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/[→←↗↘»·•]|&middot;|&rarr;|&raquo;/);
    }
  });

  it("asks no web font service for anything", () => {
    for (const [file, text] of [...Object.entries(sources), ["index.html", indexHtml]]) {
      expect(text, file).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    }
  });
});
