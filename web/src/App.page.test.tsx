import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { aboutFixture, gas, iss, liquid, lunar, lunarSnapshot, report, solid, spacesuit } from "./fixtures";

const requested: string[] = [];

function mockApi({ aboutFails = false, reports = [report] } = {}) {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok(reports);
      if (url === "/api/about") return aboutFails ? { ok: false, status: 500, json: async () => ({}) } : ok(aboutFixture);
      if (url.startsWith("/api/snapshot/map")) return ok({ key: "k", snapshot: lunarSnapshot });
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const before = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("page structure", () => {
  it("shows the hero straight away, before any data arrives", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Flame in Freefall" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay the drop" })).toBeInTheDocument();
  });

  it("runs from the hero, to the three lines, to the explorer, to the footer", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const hero = screen.getByRole("heading", { level: 1 });
    const lines = screen.getByRole("heading", { level: 2, name: "The question in three lines" });
    const explore = screen.getByRole("heading", { level: 2, name: "Explore the tests" });
    const about = screen.getByRole("heading", { level: 2, name: "About the data" });
    expect(before(hero, lines)).toBe(true);
    expect(before(lines, explore)).toBe(true);
    expect(before(explore, about)).toBe(true);
  });

  it("puts the habitat choice and the map inside the explorer", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const explorer = screen.getByRole("region", { name: "Explore the tests" });
    expect(within(explorer).getByRole("radio", { name: "Lunar base or rover" })).toBeInTheDocument();
    expect(within(explorer).getByRole("img", { name: /oxygen against pressure/i })).toBeInTheDocument();
  });

  it("offers the NASA test atmosphere as a one-click preset built from the report data", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const preset = screen.getByRole("button", { name: "NASA test atmosphere (34 %, 8.2 psi)" });
    expect(preset).toHaveAttribute("title", "Source: BRE_final_report_20220201.pdf, page 26, Figure 9");
    fireEvent.click(preset);
    await waitFor(() => expect(requested).toContain("/api/snapshot/map?habitat=custom&o2=34&psi=8.2&shown_psi_max=20"));
    expect(screen.getByLabelText("Oxygen (%)")).toHaveValue(34);
    expect(screen.getByLabelText("Pressure (psi)")).toHaveValue(8.2);
  });

  it("offers no preset when no report condition is marked as one", async () => {
    mockApi({ reports: [{ ...report, preset_label: undefined }] });
    render(<App />);
    await screen.findAllByTestId("point");
    expect(screen.queryByRole("button", { name: /NASA test atmosphere/ })).toBeNull();
  });

  it("fills the footer from the API", async () => {
    mockApi();
    render(<App />);
    const footer = await screen.findByRole("contentinfo");
    expect(await within(footer).findByText(/Data version abc123def456/)).toBeInTheDocument();
    expect(within(footer).getByRole("list", { name: "Known data problems" })).toBeInTheDocument();
  });

  it("keeps the sources line in the footer", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByTestId("sources")).toHaveTextContent("3 test points");
  });

  it("still works when the notes about the data fail to load, with no alert", async () => {
    mockApi({ aboutFails: true });
    render(<App />);
    await screen.findAllByTestId("point");
    expect(await screen.findByText("The notes about the data could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
