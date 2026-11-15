import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointCard } from "./PointCard";
import { gas, gasCard, reportCard } from "./fixtures";

function mockCard(card: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => card })));
}

afterEach(() => vi.unstubAllGlobals());

describe("the point card links to its experiment", () => {
  it("offers Open the experiment, which goes to that experiment's page", async () => {
    mockCard(gasCard);
    render(<PointCard request={{ source_file: gas.source_file, source_row: 2 }} onClose={() => {}} />);
    const link = await screen.findByRole("link", { name: "Open the experiment" });
    expect(link).toHaveAttribute("href", "#experiment/PSI-159");
    expect(link.closest("details")).toBeNull();
  });

  it("does the same for a report condition", async () => {
    mockCard(reportCard);
    render(<PointCard request={{ experiment_id: "PSI-20", test_id: "19070D1" }} onClose={() => {}} />);
    expect(await screen.findByRole("link", { name: "Open the experiment" })).toHaveAttribute("href", "#experiment/PSI-20");
  });

  it("has no link while the card is loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<PointCard request={{ source_file: gas.source_file, source_row: 2 }} onClose={() => {}} />);
    expect(screen.queryByRole("link", { name: "Open the experiment" })).toBeNull();
  });
});
