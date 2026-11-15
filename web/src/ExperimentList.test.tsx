import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExperimentList } from "./ExperimentList";
import { experimentRows } from "./fixtures";

function mockList(rows: unknown, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => rows })));
}

afterEach(() => vi.unstubAllGlobals());

describe("ExperimentList", () => {
  it("asks the API for the list", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    await screen.findByText(experimentRows[1].name);
    expect(fetch).toHaveBeenCalledWith("/api/experiment-list");
  });

  it("has a Back to the map control that goes to the map", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    await screen.findByText(experimentRows[1].name);
    expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "#");
  });

  it("says how many experiments are in the data loaded, counted from the list", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    expect(await screen.findByText("3 experiments in the PSI data loaded.")).toBeInTheDocument();
  });

  it("shows each experiment by its name as a link to its page, with what was burned and its tests", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    const link = await screen.findByRole("link", { name: experimentRows[1].name });
    expect(link).toHaveAttribute("href", "#experiment/PSI-25");
    const row = link.closest("tr") as HTMLElement;
    expect(within(row).getByText("PSI-25")).toBeInTheDocument();
    expect(within(row).getByText("Solid material")).toBeInTheDocument();
    expect(within(row).getByText("129 tests")).toBeInTheDocument();
  });

  it("says No per-test data where there are none", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    await screen.findByText(experimentRows[0].name);
    expect(screen.getAllByText("No per-test data")).toHaveLength(2);
  });

  it("marks a ground study as one", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    const row = (await screen.findByRole("link", { name: experimentRows[2].name })).closest("tr") as HTMLElement;
    expect(within(row).getByText("Ground study")).toBeInTheDocument();
    const flight = screen.getByRole("link", { name: experimentRows[1].name }).closest("tr") as HTMLElement;
    expect(within(flight).queryByText("Ground study")).toBeNull();
  });

  it("keeps the order the API gives", async () => {
    mockList(experimentRows);
    render(<ExperimentList />);
    await screen.findByText(experimentRows[0].name);
    const ids = screen.getAllByRole("row").slice(1).map((r) => within(r).getByText(/^PSI-\d+$/).textContent);
    expect(ids).toEqual(["PSI-21", "PSI-25", "PSI-60"]);
  });

  it("says it is loading, and says in plain words when the list could not be loaded, with no alert", async () => {
    mockList({}, false);
    render(<ExperimentList />);
    expect(screen.getByText("Loading the experiments...")).toBeInTheDocument();
    expect(await screen.findByText("The list of experiments could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
