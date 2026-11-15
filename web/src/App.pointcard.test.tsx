import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { aboutFixture, gas, gasCard, iss, liquid, lunar, lunarSnapshot, lunarSummary, report, reportCard, solid, solidCard, spacesuit } from "./fixtures";

const requested: string[] = [];

function mockApi() {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url === "/api/about") return ok(aboutFixture);
      if (url.startsWith("/api/snapshot/map")) return ok({ key: "k", snapshot: lunarSnapshot, summary: lunarSummary });
      if (url.includes("source_file=PSI-159")) return ok(gasCard);
      if (url.includes("source_file=PSI-25")) return ok(solidCard);
      if (url.includes("experiment_id=PSI-20")) return ok(reportCard);
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const markNamed = (text: string) =>
  screen.getAllByRole("button").find((b) => b.getAttribute("aria-label")?.startsWith(text)) as HTMLElement;

describe("click a point to read what happened", () => {
  it("shows no card until a point is chosen", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    expect(screen.queryByRole("region", { name: "Test details" })).toBeNull();
  });

  it("opens the card for the clicked test point, inside the explorer", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(markNamed("PSI-159"));
    const card = await screen.findByRole("region", { name: "Test details" });
    expect(within(screen.getByRole("region", { name: "Explore the tests" })).getByRole("region", { name: "Test details" })).toBe(card);
    expect(within(card).getByText(gasCard.result)).toBeInTheDocument();
    expect(requested).toContain("/api/point-card?source_file=PSI-159_Experimental+table_CFI-G_Normal+Flames.csv&source_row=2");
  });

  it("opens the card for a report condition", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(markNamed("PSI-20"));
    expect(await screen.findByText(reportCard.result)).toBeInTheDocument();
  });

  it("replaces the card when another point is chosen", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(markNamed("PSI-159"));
    await screen.findByText(gasCard.title);
    fireEvent.click(markNamed("PSI-25"));
    await screen.findByText(solidCard.title);
    expect(screen.queryByText(gasCard.title)).toBeNull();
    expect(screen.getAllByRole("region", { name: "Test details" })).toHaveLength(1);
  });

  it("opens from the keyboard with Enter", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const mark = markNamed("PSI-159");
    mark.focus();
    fireEvent.keyDown(mark, { key: "Enter" });
    expect(await screen.findByText(gasCard.result)).toBeInTheDocument();
  });

  it("closes the card and puts focus back on the mark", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const mark = markNamed("PSI-159");
    mark.focus();
    fireEvent.click(mark);
    await screen.findByText(gasCard.result);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Test details" })).toBeNull());
    expect(document.activeElement).toBe(mark);
  });
});
