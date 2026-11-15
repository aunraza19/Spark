import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KnowDontKnow } from "./KnowDontKnow";
import { customSummary, lunarSummary } from "./fixtures";

describe("KnowDontKnow", () => {
  it("is a section named What we know, what we don't", () => {
    render(<KnowDontKnow summary={lunarSummary} />);
    expect(screen.getByRole("region", { name: "What we know, what we don't" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "What we know, what we don't" })).toBeInTheDocument();
  });

  it("lists every computed line in two columns", () => {
    render(<KnowDontKnow summary={lunarSummary} />);
    const know = within(screen.getByRole("list", { name: "What we know" }));
    const dont = within(screen.getByRole("list", { name: "What we don't know" }));
    expect(know.getAllByRole("listitem").map((li) => li.textContent)).toEqual(lunarSummary.know);
    expect(dont.getAllByRole("listitem").map((li) => li.textContent)).toEqual(lunarSummary.dont_know);
  });

  it("says in plain words when one column has nothing", () => {
    render(<KnowDontKnow summary={customSummary} />);
    expect(screen.queryByRole("list", { name: "What we know" })).toBeNull();
    expect(screen.getByText("Nothing in the data for this choice.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "What we don't know" })).getAllByRole("listitem")).toHaveLength(
      customSummary.dont_know.length,
    );
  });

  it("shows nothing until the summary arrives", () => {
    render(<KnowDontKnow summary={null} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
