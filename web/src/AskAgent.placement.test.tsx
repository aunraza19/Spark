import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DataSaysCard } from "./DataSaysCard";
import { ExperimentPage } from "./ExperimentPage";
import {
  aboutFixture, explanationOk, gas, iss, liquid, lunar, lunarSnapshot, lunarSummary, pageFixture, rankingFixture, report, solid, spacesuit,
} from "./fixtures";
import { RankedList } from "./RankedList";
import { ScenarioPanel } from "./ScenarioPanel";

const posted: unknown[] = [];

function mockApi() {
  posted.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/agent/explain") {
        posted.push(JSON.parse(init?.body as string));
        return ok(explanationOk);
      }
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url === "/api/about") return ok(aboutFixture);
      if (url.startsWith("/api/snapshot/map")) return ok({ key: "k", snapshot: lunarSnapshot, summary: lunarSummary });
      if (url.startsWith("/api/ranking")) return ok(rankingFixture);
      if (url.startsWith("/api/experiment-page/")) return ok(pageFixture);
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const ask = () => screen.getByRole("button", { name: "Ask Spark agent" });

describe("the What the data says here card", () => {
  it("has the button, outside Show the evidence, only when it is given a block", () => {
    const { rerender } = render(<DataSaysCard summary={lunarSummary} />);
    expect(screen.queryByRole("button", { name: "Ask Spark agent" })).toBeNull();
    rerender(<DataSaysCard summary={lunarSummary} ask={{ kind: "map", habitat: "lunar", shown_psi_max: 20 }} />);
    expect(ask().closest("details")).toBeNull();
    expect(screen.getByRole("heading", { name: "What the data says here" }).closest("section")).toContainElement(ask());
  });

  it("asks about the map the page shows: the habitat and the pressure range in view", async () => {
    mockApi();
    render(<App />);
    const heading = await screen.findByRole("heading", { name: "What the data says here" }, { timeout: 12000 });
    const card = heading.closest("section") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Ask Spark agent" }));
    await within(card).findByText("Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.", undefined, { timeout: 12000 });
    expect(posted).toEqual([{ block: { kind: "map", habitat: "lunar", shown_psi_max: 20 } }]);
  });

  it("asks about a custom target by its numbers", async () => {
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { name: "What the data says here" }, { timeout: 12000 });
    fireEvent.click(await screen.findByRole("button", { name: "NASA test atmosphere (34 %, 8.2 psi)" }, { timeout: 12000 }));
    const card = screen.getByRole("heading", { name: "What the data says here" }).closest("section") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Ask Spark agent" }));
    await within(card).findByText("Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.", undefined, { timeout: 12000 });
    expect(posted).toEqual([{ block: { kind: "map", habitat: "custom", o2: 34, psi: 8.2, shown_psi_max: 20 } }]);
  });
});

describe("the custom scenario", () => {
  const snapshot = {
    schema: "s", data_version: "v", panel: "scenario" as const,
    habitat: { id: "custom", kind: "point", source: "x", o2_pct: 34, pressure_psi: 8.2 },
    view: { distance_rule: "r", tests_at_target: 1, report_conditions_at_target: 0, nearest_tests: [], inside_lunar_zone: true },
  };

  it("has the button, asking about the scenario by its numbers", async () => {
    mockApi();
    render(<ScenarioPanel snapshot={snapshot} ask={{ kind: "scenario", o2: 34, psi: 8.2 }} />);
    fireEvent.click(ask());
    await screen.findByText("Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.");
    expect(posted).toEqual([{ block: { kind: "scenario", o2: 34, psi: 8.2 } }]);
  });

  it("has no button without a block, or while the scenario has not loaded", () => {
    const { rerender } = render(<ScenarioPanel snapshot={snapshot} />);
    expect(screen.queryByRole("button", { name: "Ask Spark agent" })).toBeNull();
    rerender(<ScenarioPanel snapshot={null} ask={{ kind: "scenario", o2: 34, psi: 8.2 }} />);
    expect(screen.queryByRole("button", { name: "Ask Spark agent" })).toBeNull();
  });
});

describe("the ranked list", () => {
  it("has the button under the lead sentences, asking about the chosen habitat", async () => {
    mockApi();
    render(<RankedList selection={{ habitatId: "lunar" }} />);
    await screen.findAllByTestId("ranking-lead");
    const lead = screen.getAllByTestId("ranking-lead").at(-1) as HTMLElement;
    expect(Boolean(lead.compareDocumentPosition(ask()) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    fireEvent.click(ask());
    await screen.findByText("Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.");
    expect(posted).toEqual([{ block: { kind: "ranking", habitat: "lunar" } }]);
  });

  it("asks about a custom target by its numbers", async () => {
    mockApi();
    render(<RankedList selection={{ habitatId: "custom", custom: { o2: 28, psi: 9 } }} />);
    await screen.findAllByTestId("ranking-lead");
    fireEvent.click(ask());
    await screen.findByText("Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.");
    expect(posted).toEqual([{ block: { kind: "ranking", habitat: "custom", o2: 28, psi: 9 } }]);
  });

  it("has no button while the ranking is loading or when it failed", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<RankedList selection={{ habitatId: "lunar" }} />);
    expect(screen.queryByRole("button", { name: "Ask Spark agent" })).toBeNull();
  });
});

describe("an experiment page", () => {
  it("has the button under the lead sentences, asking about that experiment", async () => {
    mockApi();
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    const lead = screen.getAllByTestId("lead-line").at(-1) as HTMLElement;
    expect(Boolean(lead.compareDocumentPosition(ask()) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    fireEvent.click(ask());
    await screen.findByText("Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.");
    expect(posted).toEqual([{ block: { kind: "experiment", experiment_id: "PSI-25" } }]);
  });
});
