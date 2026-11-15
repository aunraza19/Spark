import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExperimentList } from "./ExperimentList";
import { reportRow } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("the list with an experiment whose conditions come from a NASA report", () => {
  it("shows the API's words, not a count of tests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [reportRow] })));
    render(<ExperimentList />);
    const row = (await screen.findByRole("link", { name: reportRow.name })).closest("tr") as HTMLElement;
    expect(within(row).getByText("3 conditions from a NASA report")).toBeInTheDocument();
    expect(within(row).queryByText(/tests/)).toBeNull();
  });

  it("heads the column with tests or report conditions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [reportRow] })));
    render(<ExperimentList />);
    expect(await screen.findByRole("columnheader", { name: "Tests or report conditions on the map" })).toBeInTheDocument();
  });
});
