import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { aboutFixture, experimentRows, gas, iss, liquid, lunar, lunarSnapshot, lunarSummary, pageFixture, rankingFixture, report, solid, spacesuit } from "./fixtures";

const requested: string[] = [];

function mockApi({ rankingFails = false } = {}) {
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
      if (url.startsWith("/api/ranking")) return rankingFails ? { ok: false, status: 500, json: async () => ({}) } : ok(rankingFixture);
      if (url === "/api/experiment-list") return ok(experimentRows);
      if (url.startsWith("/api/experiment-page/")) return ok(pageFixture);
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("the ranked list on the map page", () => {
  it("sits under the map, before what we know and what we don't", async () => {
    mockApi();
    render(<App />);
    const ranked = await screen.findByRole("heading", { name: "Experiments, closest first" });
    expect(before(screen.getByRole("group", { name: /oxygen against pressure/i }), ranked)).toBe(true);
    expect(before(ranked, await screen.findByRole("heading", { level: 2, name: "What we know, what we don't" }))).toBe(true);
  });

  it("is inside the explorer and asks for the chosen habitat", async () => {
    mockApi();
    render(<App />);
    const heading = await screen.findByRole("heading", { name: "Experiments, closest first" });
    expect(screen.getByRole("region", { name: "Explore the tests" })).toContainElement(heading);
    await waitFor(() => expect(requested).toContain("/api/ranking?habitat=lunar"));
  });

  it("asks again when the habitat changes", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { name: "Experiments, closest first" });
    fireEvent.click(screen.getByRole("radio", { name: "ISS cabin" }));
    await waitFor(() => expect(requested).toContain("/api/ranking?habitat=iss"));
  });

  it("fails quietly: the page still works when the ranking cannot be loaded", async () => {
    mockApi({ rankingFails: true });
    render(<App />);
    expect(await screen.findByText("The ranking could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByTestId("point").length).toBeGreaterThan(0);
  });
});

describe("addresses you can share", () => {
  it("opens an experiment page from #experiment/PSI-25, with no hero and with the footer", async () => {
    window.location.hash = "#experiment/PSI-25";
    mockApi();
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "BASS-II (PSI-25)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Flame in Freefall" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "About the data" })).toBeInTheDocument();
    expect(requested).toContain("/api/experiment-page/PSI-25");
  });

  it("opens the list of all experiments from #experiments", async () => {
    window.location.hash = "#experiments";
    mockApi();
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "All experiments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: experimentRows[1].name })).toHaveAttribute("href", "#experiment/PSI-25");
  });

  it("opens an experiment when a row of the ranked list is followed", async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "ACME CFI-G (PSI-159)" }));
    expect(await screen.findByRole("heading", { level: 1, name: "BASS-II (PSI-25)" })).toBeInTheDocument();
    expect(requested).toContain("/api/experiment-page/PSI-159");
  });

  it("goes back to the map from an experiment page", async () => {
    window.location.hash = "#experiment/PSI-25";
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Back to the map" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Flame in Freefall" })).toBeInTheDocument();
    expect(await screen.findAllByTestId("point")).not.toHaveLength(0);
  });

  it("follows the address when it changes", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Flame in Freefall" });
    act(() => {
      window.location.hash = "#experiments";
    });
    expect(await screen.findByRole("heading", { level: 1, name: "All experiments" })).toBeInTheDocument();
  });

  it("opens the list from the link under the ranked list", async () => {
    mockApi();
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "See all 5 experiments" }));
    expect(await screen.findByRole("heading", { level: 1, name: "All experiments" })).toBeInTheDocument();
  });
});
