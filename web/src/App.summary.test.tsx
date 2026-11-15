import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { aboutFixture, customSummary, gas, iss, liquid, lunar, lunarSnapshot, lunarSummary, report, solid, spacesuit } from "./fixtures";

function mockApi({ withSummary = true } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url === "/api/about") return ok(aboutFixture);
      if (url.startsWith("/api/snapshot/map")) {
        const summary = url.includes("habitat=custom") ? customSummary : lunarSummary;
        return ok(withSummary ? { key: "k", snapshot: lunarSnapshot, summary } : { key: "k", snapshot: lunarSnapshot });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function visibleOutsideFooterAndEvidence(): string {
  const copy = document.body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("footer, details").forEach((el) => el.remove());
  return (copy.textContent ?? "").toLowerCase();
}

describe("the explorer says it in words first", () => {
  it("leads the map with the sentences computed by the API", async () => {
    mockApi();
    render(<App />);
    const card = (await screen.findByRole("heading", { name: "What the data says here" })).closest("section") as HTMLElement;
    const lines = within(card).getAllByTestId("lead-line").map((p) => p.textContent);
    expect(lines).toEqual(lunarSummary.lead);
  });

  it("puts the card inside the explorer, before the map", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { name: "What the data says here" });
    const explorer = screen.getByRole("region", { name: "Explore the tests" });
    expect(within(explorer).getByRole("heading", { name: "What the data says here" })).toBeInTheDocument();
    expect(before(screen.getByRole("heading", { name: "What the data says here" }), screen.getByRole("group", { name: /oxygen against pressure/i }))).toBe(true);
  });

  it("moves the old summary behind Show the evidence", async () => {
    mockApi();
    render(<App />);
    const card = (await screen.findByRole("heading", { name: "What the data says here" })).closest("section") as HTMLElement;
    await screen.findByTestId("inside-zone");
    const details = within(card).getByText("Show the evidence").closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByTestId("inside-zone")).toBeInTheDocument();
  });

  it("shows the know and don't-know columns after the explorer and before the footer", async () => {
    mockApi();
    render(<App />);
    const know = await screen.findByRole("heading", { level: 2, name: "What we know, what we don't" });
    expect(before(screen.getByRole("heading", { level: 2, name: "Explore the tests" }), know)).toBe(true);
    expect(before(know, screen.getByRole("heading", { level: 2, name: "About the data" }))).toBe(true);
    expect(screen.getByText(lunarSummary.dont_know[0])).toBeInTheDocument();
  });

  it("follows the choice: the custom target brings its own sentences", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { name: "What the data says here" });
    fireEvent.click(screen.getByRole("button", { name: "NASA test atmosphere (34 %, 8.2 psi)" }));
    await waitFor(() => expect(screen.getByText(customSummary.lead[0])).toBeInTheDocument());
    expect(screen.queryByText(lunarSummary.lead[0])).toBeNull();
    expect(screen.getByText(customSummary.dont_know[0])).toBeInTheDocument();
  });

  it("keeps the technical words for the footer and the evidence", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { name: "What we know, what we don't" });
    const text = visibleOutsideFooterAndEvidence();
    expect(text).toContain("what the data says here");
    for (const word of ["snapshot", "data version", "distance"]) expect(text).not.toContain(word);
  });

  it("still works when the API sends no summary: no card sentences, evidence kept", async () => {
    mockApi({ withSummary: false });
    render(<App />);
    await screen.findByTestId("inside-zone");
    expect(screen.queryAllByTestId("lead-line")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "What we know, what we don't" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
