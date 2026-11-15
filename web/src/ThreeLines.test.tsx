import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { THREE_LINES } from "./content";
import { ThreeLines } from "./ThreeLines";

describe("ThreeLines", () => {
  it("has a heading and the three lines in order", () => {
    render(<ThreeLines />);
    expect(screen.getByRole("heading", { level: 2, name: "The question in three lines" })).toBeInTheDocument();
    const terms = screen.getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["What NASA tested", "What we built", "Why it matters"]);
    const definitions = screen.getAllByRole("definition").map((d) => d.textContent);
    expect(definitions).toEqual(THREE_LINES.map((l) => l.text));
  });
});
