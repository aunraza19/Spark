import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEDE } from "./content";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("leads with the title and one plain sentence", () => {
    render(<Hero />);
    expect(screen.getByRole("heading", { level: 1, name: "Flame in Freefall" })).toBeInTheDocument();
    expect(screen.getByText(LEDE)).toBeInTheDocument();
  });

  it("shows the flame animation with its captions and its label", () => {
    render(<Hero />);
    expect(screen.getByRole("img", { name: /two flames/i })).toBeInTheDocument();
    expect(screen.getByText("Illustration, not data")).toBeInTheDocument();
    expect(screen.getByText("On Earth: hot gas rises, the flame is a tall teardrop.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay the drop" })).toBeInTheDocument();
  });

  it("makes no AI claim", () => {
    render(<Hero />);
    expect(document.body.textContent).not.toMatch(/AI-powered/i);
  });
});
