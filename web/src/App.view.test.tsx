import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Point } from "./api";
import App from "./App";
import { customSnapshot, far, gas, iss, liquid, lunar, lunarSnapshot, report, reportFar, solid, spacesuit } from "./fixtures";

function mockApi(points: Point[], reports = [report, reportFar]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok(points);
      if (url === "/api/report-conditions") return ok(reports);
      if (url.startsWith("/api/snapshot/map")) {
        return ok({ key: "k", snapshot: url.includes("habitat=lunar") ? lunarSnapshot : customSnapshot });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const allPoints = [gas, liquid, solid, far];

describe("App pressure range", () => {
  it("starts at 0 to 20 psi and says how many marks are not shown, on the map and in the summary", async () => {
    mockApi(allPoints);
    render(<App />);
    expect(await screen.findAllByTestId("point")).toHaveLength(3);
    expect(screen.getAllByTestId("report-condition")).toHaveLength(1);
    for (const id of ["view-note", "summary-view-note"]) {
      const text = (await screen.findByTestId(id)).textContent ?? "";
      expect(text).toContain("Showing 0 to 20 psi.");
      expect(text).toContain("1 test point above 20 psi is not shown");
      expect(text).toContain("1 report condition above 20 psi is not shown");
    }
  });

  it("never hides marks without saying so: drawn plus counted equals the data", async () => {
    mockApi(allPoints);
    render(<App />);
    const drawn = (await screen.findAllByTestId("point")).length;
    const note = screen.getByTestId("view-note").textContent ?? "";
    const hidden = Number(/(\d+) test points? above/.exec(note)?.[1]);
    expect(drawn + hidden).toBe(allPoints.length);
  });

  it("has a Show the full pressure range control that is off and enabled at first", async () => {
    mockApi(allPoints);
    render(<App />);
    await screen.findAllByTestId("point");
    const control = screen.getByRole("checkbox", { name: "Show the full pressure range" });
    expect(control).not.toBeChecked();
    expect(control).toBeEnabled();
  });

  it("shows every mark with Show the full pressure range and goes back to 0 to 20 psi when it is switched off", async () => {
    mockApi(allPoints);
    render(<App />);
    await screen.findAllByTestId("point");
    const control = screen.getByRole("checkbox", { name: "Show the full pressure range" });
    fireEvent.click(control);
    await waitFor(() => expect(screen.getAllByTestId("point")).toHaveLength(4));
    expect(screen.getAllByTestId("report-condition")).toHaveLength(2);
    expect(screen.getByTestId("view-note")).toHaveTextContent("Showing the full range, 0 to 80 psi.");
    expect(screen.getByTestId("summary-view-note")).toHaveTextContent("Showing the full range, 0 to 80 psi.");
    fireEvent.click(control);
    await waitFor(() => expect(screen.getAllByTestId("point")).toHaveLength(3));
  });

  it("switches to the full range by itself when a custom target is above 20 psi, and says why", async () => {
    mockApi(allPoints);
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    fireEvent.change(await screen.findByLabelText("Pressure (psi)"), { target: { value: "30" } });
    await waitFor(() => expect(screen.getAllByTestId("point")).toHaveLength(4));
    const control = screen.getByRole("checkbox", { name: "Show the full pressure range" });
    expect(control).toBeChecked();
    expect(control).toBeDisabled();
    expect(screen.getByTestId("view-note")).toHaveTextContent("because your target is above 20 psi");
    expect(screen.getByTestId("summary-view-note")).toHaveTextContent("because your target is above 20 psi");
  });

  it("returns to the chosen range when the custom target comes back to 20 psi or less", async () => {
    mockApi(allPoints);
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    fireEvent.change(await screen.findByLabelText("Pressure (psi)"), { target: { value: "30" } });
    await waitFor(() => expect(screen.getAllByTestId("point")).toHaveLength(4));
    fireEvent.change(screen.getByLabelText("Pressure (psi)"), { target: { value: "9" } });
    await waitFor(() => expect(screen.getAllByTestId("point")).toHaveLength(3));
    expect(screen.getByRole("checkbox", { name: "Show the full pressure range" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Show the full pressure range" })).not.toBeChecked();
  });

  it("says so when nothing is hidden", async () => {
    mockApi([gas, liquid, solid], [report]);
    render(<App />);
    await screen.findAllByTestId("point");
    expect(screen.getByTestId("view-note")).toHaveTextContent("No test points above 20 psi are hidden");
  });
});
