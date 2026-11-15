import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExperimentPage } from "./ExperimentPage";
import { groundPageFixture, pageFixture } from "./fixtures";

function mockPage(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: status === 200, status, json: async () => body })));
}

afterEach(() => vi.unstubAllGlobals());

const evidence = () => screen.getByText("Show the evidence").closest("details") as HTMLElement;

describe("ExperimentPage", () => {
  it("asks the API for this experiment", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1, name: "BASS-II (PSI-25)" });
    expect(fetch).toHaveBeenCalledWith("/api/experiment-page/PSI-25");
  });

  it("has a Back to the map control that goes to the map", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "#");
  });

  it("gives the full name under the title", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    expect(await screen.findByText("Burning and Suppression of Solids - II")).toBeInTheDocument();
  });

  it("leads with the plain sentences, outside the evidence", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    const lines = screen.getAllByTestId("lead-line");
    expect(lines.map((l) => l.textContent)).toEqual(pageFixture.lead);
    for (const line of lines) expect(line.closest("details")).toBeNull();
  });

  it("labels the key results as the record's own words, and shows the first three outside the evidence", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    expect(await screen.findByText("From the experiment record (extracted from NASA PSI)")).toBeInTheDocument();
    for (const result of pageFixture.key_results.slice(0, 3)) {
      expect(screen.getByText(result).closest("details")).toBeNull();
    }
  });

  it("keeps the other key results behind Show the evidence", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    for (const result of pageFixture.key_results.slice(3)) {
      expect(within(evidence()).getByText(result)).toBeInTheDocument();
    }
  });

  it("keeps the evidence closed, with conditions, sensors, publications and data-quality notes inside", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    expect(evidence()).not.toHaveAttribute("open");
    const inside = within(evidence());
    expect(inside.getByText("Tests on the map: 129.")).toBeInTheDocument();
    expect(inside.getByText("Oxygen on the map: 12 to 22.2 %. Pressure on the map: 14.5 to 14.7 psi.")).toBeInTheDocument();
    expect(inside.getByText("Source: PSI-25_Experimental table_BASS-II.csv.")).toBeInTheDocument();
    expect(inside.getByText(pageFixture.evidence.conditions.record_note)).toBeInTheDocument();
    expect(inside.getByText("thermopile radiometer (Oriel 71768), uncalibrated")).toBeInTheDocument();
    expect(inside.getByText(pageFixture.evidence.data_quality_notes[0])).toBeInTheDocument();
    expect(inside.getByText("cast PMMA (acrylic) thin films")).toBeInTheDocument();
  });

  it("links each publication to its page", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    const link = within(evidence()).getByRole("link", { name: "Microgravity flammability boundary for PMMA rods" });
    expect(link).toHaveAttribute("href", "http://dx.doi.org/10.1016/j.combustflame.2017.03.001");
    expect(within(evidence()).getByText(/Olson Sandra L\., Ferkul Paul V\./)).toBeInTheDocument();
  });

  it("names the record file and the reports it came from", async () => {
    mockPage(pageFixture);
    render(<ExperimentPage id="PSI-25" />);
    await screen.findByRole("heading", { level: 1 });
    expect(within(evidence()).getByText("Record: data/incoming/experiments/psi-25.json.")).toBeInTheDocument();
    expect(within(evidence()).getByText("Reports: BASS-II Summary Report.pdf.")).toBeInTheDocument();
  });

  it("says so when no test is on the map, and shows no ranges", async () => {
    mockPage(groundPageFixture);
    render(<ExperimentPage id="PSI-60" />);
    await screen.findByRole("heading", { level: 1 });
    expect(within(evidence()).getByText("Tests on the map: none.")).toBeInTheDocument();
    expect(within(evidence()).queryByText(/Oxygen on the map/)).toBeNull();
  });

  it("says so when the record lists no key results", async () => {
    mockPage(groundPageFixture);
    render(<ExperimentPage id="PSI-60" />);
    expect(await screen.findByText("The record lists no key results.")).toBeInTheDocument();
  });

  it("says in plain words when there is no such experiment, and still offers the way back", async () => {
    mockPage({}, 404);
    render(<ExperimentPage id="PSI-999" />);
    expect(await screen.findByText("No experiment with the id PSI-999 in the data loaded.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the map" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says in plain words when the experiment could not be loaded, with no alert", async () => {
    mockPage({}, 500);
    render(<ExperimentPage id="PSI-25" />);
    expect(await screen.findByText("The experiment could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says it is loading first", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<ExperimentPage id="PSI-25" />);
    expect(screen.getByText("Loading the experiment...")).toBeInTheDocument();
  });
});
