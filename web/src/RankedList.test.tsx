import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankedList } from "./RankedList";
import { rankingFixture } from "./fixtures";

const requested: string[] = [];

function mockRanking(body: unknown, ok = true) {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      return { ok, status: ok ? 200 : 500, json: async () => body };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const lunar = { habitatId: "lunar" };

describe("RankedList", () => {
  it("asks for the ranking of the chosen habitat", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    await screen.findAllByTestId("ranking-lead");
    expect(requested).toEqual(["/api/ranking?habitat=lunar"]);
  });

  it("asks for the ranking of a custom target by its numbers, and again when it changes", async () => {
    mockRanking(rankingFixture);
    const { rerender } = render(<RankedList selection={{ habitatId: "custom", custom: { o2: 28, psi: 9 } }} />);
    await screen.findAllByTestId("ranking-lead");
    rerender(<RankedList selection={lunar} />);
    await vi.waitFor(() => expect(requested).toEqual(["/api/ranking?habitat=custom&o2=28&psi=9", "/api/ranking?habitat=lunar"]));
  });

  it("has a heading, and leads with the sentences computed by the API", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    expect(await screen.findByRole("heading", { name: "Experiments, closest first" })).toBeInTheDocument();
    expect(screen.getAllByTestId("ranking-lead").map((p) => p.textContent)).toEqual(rankingFixture.lead);
  });

  it("lists the experiments in rank order, each with its rank, its name and its material in words", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    await screen.findAllByTestId("ranking-lead");
    const rows = screen.getAllByTestId("ranked-row");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[1]).getByText("2")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Emulated solid")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Liquid")).toBeInTheDocument();
  });

  it("opens the experiment page from each row", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    const link = await screen.findByRole("link", { name: "ACME CFI-G (PSI-159)" });
    expect(link).toHaveAttribute("href", "#experiment/PSI-159");
    expect(screen.getByRole("link", { name: "FLEX (PSI-69)" })).toHaveAttribute("href", "#experiment/PSI-69");
  });

  it("draws a bar for how close the tests came, with the value for assistive technology only", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    await screen.findAllByTestId("ranking-lead");
    const bars = screen.getAllByRole("meter", { name: "How close its tests came to this atmosphere" });
    expect(bars.map((b) => b.getAttribute("aria-valuenow"))).toEqual(["100", "100", "98.7"]);
    for (const row of screen.getAllByTestId("ranked-row")) expect(row.textContent).not.toMatch(/98\.7|179|273|\bour weighting\b/);
  });

  it("keeps the numbers, the weights and the rules behind Show the evidence, labelled our weighting", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    await screen.findAllByTestId("ranking-lead");
    const details = screen.getByText("Show the evidence").closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    const inside = within(details);
    expect(inside.getByRole("columnheader", { name: "Atmosphere match" })).toBeInTheDocument();
    expect(inside.getByRole("columnheader", { name: "Tests inside the zone" })).toBeInTheDocument();
    expect(inside.getByRole("columnheader", { name: "Tests or report conditions on the map" })).toBeInTheDocument();
    expect(inside.getByRole("columnheader", { name: "Material relevance (our weighting)" })).toBeInTheDocument();
    expect(inside.getByText("98.7")).toBeInTheDocument();
    expect(inside.getByText("273")).toBeInTheDocument();
    expect(inside.getByText(rankingFixture.evidence.distance_rule)).toBeInTheDocument();
    expect(inside.getByText(rankingFixture.evidence.sort_rule)).toBeInTheDocument();
    expect(inside.getByText("Solid material: 100")).toBeInTheDocument();
    expect(inside.getByText("No burning test: 0")).toBeInTheDocument();
  });

  it("lists the experiments that could not be scored in a closed list, each with its reason", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    await screen.findAllByTestId("ranking-lead");
    const summary = screen.getByText("Experiments that could not be scored (2)");
    const details = summary.closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    const first = within(details).getByRole("link", { name: "CDFF (PSI-21)" }).closest("li") as HTMLElement;
    expect(first).toHaveTextContent("no per-test conditions in the tables loaded");
    const second = within(details).getByRole("link", { name: "SPICE analysis (PSI-60)" });
    expect(second).toHaveAttribute("href", "#experiment/PSI-60");
    expect(second.closest("li")).toHaveTextContent("ground study: no test table of its own");
  });

  it("links to the list of all experiments, with the count worked out from the ranking", async () => {
    mockRanking(rankingFixture);
    render(<RankedList selection={lunar} />);
    const link = await screen.findByRole("link", { name: "See all 5 experiments" });
    expect(link).toHaveAttribute("href", "#experiments");
  });

  it("says it is loading, and says in plain words when the ranking could not be loaded, with no alert", async () => {
    mockRanking({}, false);
    render(<RankedList selection={lunar} />);
    expect(screen.getByText("Loading the ranking...")).toBeInTheDocument();
    expect(await screen.findByText("The ranking could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
