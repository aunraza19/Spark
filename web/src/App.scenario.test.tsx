import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { customSnapshot, gas, iss, liquid, lunar, lunarSnapshot, report, scenarioSnapshot, solid, spacesuit } from "./fixtures";

const requested: string[] = [];

function mockApi(scenarioFails = false) {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url.startsWith("/api/snapshot/map")) {
        return ok({ key: "k", snapshot: url.includes("habitat=lunar") ? lunarSnapshot : customSnapshot });
      }
      if (url.startsWith("/api/snapshot/scenario")) {
        if (scenarioFails) return { ok: false, status: 500, json: async () => ({}) };
        return ok({ key: "k", snapshot: scenarioSnapshot });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

beforeEach(() => mockApi());
afterEach(() => vi.unstubAllGlobals());

async function chooseCustom(o2: string, psi: string) {
  fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
  fireEvent.change(await screen.findByLabelText("Oxygen (%)"), { target: { value: o2 } });
  fireEvent.change(screen.getByLabelText("Pressure (psi)"), { target: { value: psi } });
}

describe("App custom scenario", () => {
  it("shows no scenario panel for the lunar zone or the ISS", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    expect(screen.queryByRole("heading", { name: "Custom scenario" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "ISS cabin" }));
    await waitFor(() => expect(screen.queryByTestId("zone")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Custom scenario" })).toBeNull();
    expect(requested.some((url) => url.includes("/api/snapshot/scenario"))).toBe(false);
  });

  it("asks the API for the scenario and lists the nearest tests for a custom target", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    await chooseCustom("28", "9");
    await waitFor(() => expect(requested).toContain("/api/snapshot/scenario?o2=28&psi=9"));
    expect(await screen.findAllByTestId("scenario-row")).toHaveLength(5);
    expect(screen.getByRole("heading", { level: 2, name: "Custom scenario" })).toBeInTheDocument();
  });

  it("asks for no scenario while the custom numbers are invalid", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    await chooseCustom("28", "9");
    await waitFor(() => expect(requested).toContain("/api/snapshot/scenario?o2=28&psi=9"));
    const before = requested.length;
    fireEvent.change(screen.getByLabelText("Oxygen (%)"), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(requested.length).toBe(before);
  });

  it("removes the panel when another habitat is chosen again", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    await chooseCustom("28", "9");
    await screen.findAllByTestId("scenario-row");
    fireEvent.click(screen.getByRole("radio", { name: "Lunar base or rover" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Custom scenario" })).toBeNull());
  });

  it("keeps the map and shows a plain message when only the scenario fails", async () => {
    mockApi(true);
    render(<App />);
    await screen.findAllByTestId("point");
    await chooseCustom("28", "9");
    expect(await screen.findByText("Could not load the scenario.")).toBeInTheDocument();
    expect(screen.getAllByTestId("point")).toHaveLength(3);
    expect(screen.getByTestId("habitat-marker")).toBeInTheDocument();
  });
});
