import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExperimentPage } from "./ExperimentPage";
import { reportPageFixture } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("an experiment whose conditions come from a NASA report", () => {
  it("says conditions from a NASA report, not tests, in the lead", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => reportPageFixture })));
    render(<ExperimentPage id="PSI-20" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByTestId("lead-line").map((l) => l.textContent)).toContain("3 conditions from a NASA report are on the map.");
  });

  it("counts them apart from tests in the evidence, and names the range as on the map", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => reportPageFixture })));
    render(<ExperimentPage id="PSI-20" />);
    await screen.findByRole("heading", { level: 1 });
    const inside = within(screen.getByText("Show the evidence").closest("details") as HTMLElement);
    expect(inside.getByText("Tests on the map: none.")).toBeInTheDocument();
    expect(inside.getByText("Conditions from a NASA report: 3.")).toBeInTheDocument();
    expect(inside.getByText("Oxygen on the map: 27 to 34 %. Pressure on the map: 8.2 to 10.2 psi.")).toBeInTheDocument();
  });
});
