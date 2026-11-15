import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { customSnapshot, gas, iss, liquid, lunar, lunarSnapshot, report, solid, spacesuit } from "./fixtures";

const requested: string[] = [];

function mockApi(failing = false) {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (failing) return { ok: false, status: 500, json: async () => ({}) };
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url.startsWith("/api/snapshot/map")) {
        const snapshot = url.includes("habitat=lunar") ? lunarSnapshot : customSnapshot;
        return ok({ key: "k", snapshot });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

beforeEach(() => mockApi());
afterEach(() => vi.unstubAllGlobals());

describe("App first screen", () => {
  it("draws one mark per ambient point from the API, with the lunar zone shaded by default", async () => {
    render(<App />);
    expect(await screen.findAllByTestId("point")).toHaveLength(3);
    expect(screen.getByTestId("zone")).toBeInTheDocument();
    expect(screen.getByTestId("report-condition")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Lunar base or rover" })).toBeChecked();
  });

  it("asks the API for the lunar snapshot and shows its summary", async () => {
    render(<App />);
    expect(await screen.findByTestId("inside-zone")).toHaveTextContent("20 test points");
    expect(requested).toContain("/api/snapshot/map?habitat=lunar&shown_psi_max=20");
  });

  it("never asks the API for burner points", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    expect(requested.some((url) => url.includes("burner"))).toBe(false);
  });

  it("shows the ISS as a marker and removes the zone when the ISS is chosen", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("radio", { name: "ISS cabin" }));
    await waitFor(() => expect(screen.queryByTestId("zone")).toBeNull());
    expect(screen.getByTestId("habitat-marker")).toBeInTheDocument();
    await waitFor(() => expect(requested).toContain("/api/snapshot/map?habitat=iss&shown_psi_max=20"));
  });

  it("sends a valid custom scenario to the API and marks it on the map", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    fireEvent.change(await screen.findByLabelText("Oxygen (%)"), { target: { value: "28" } });
    fireEvent.change(screen.getByLabelText("Pressure (psi)"), { target: { value: "9" } });
    await waitFor(() => expect(requested).toContain("/api/snapshot/map?habitat=custom&o2=28&psi=9&shown_psi_max=20"));
    expect(screen.getByTestId("habitat-marker")).toBeInTheDocument();
  });

  it("states where the numbers come from", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    const sources = screen.getByTestId("sources").textContent ?? "";
    expect(sources).toContain("3 test points");
    expect(sources).toContain("PSI test tables");
    expect(sources).toContain("1 report condition");
    expect(sources).toContain("BRE_final_report_20220201.pdf");
  });

  it("shows a plain message when the API cannot be reached", async () => {
    mockApi(true);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the data");
    expect(screen.getByRole("heading", { level: 1, name: "Flame in Freefall" })).toBeInTheDocument();
  });
});
