import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { customSnapshot, far, gas, iss, liquid, lunar, lunarSnapshot, report, solid, spacesuit } from "./fixtures";

const requested: string[] = [];
const mapRequests = () => requested.filter((url) => url.startsWith("/api/snapshot/map"));

beforeEach(() => {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid, far]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url.startsWith("/api/snapshot/map")) {
        return ok({ key: "k", snapshot: url.includes("habitat=lunar") ? lunarSnapshot : customSnapshot });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("App sends the pressure view with the map snapshot request", () => {
  it("asks for the 0 to 20 psi view by default", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    await waitFor(() => expect(mapRequests()).toContain("/api/snapshot/map?habitat=lunar&shown_psi_max=20"));
  });

  it("asks again with the full range when Show all is switched on, and again when it is off", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("checkbox", { name: "Show all" }));
    await waitFor(() => expect(mapRequests()).toContain("/api/snapshot/map?habitat=lunar&shown_psi_max=80"));
    const before = mapRequests().length;
    fireEvent.click(screen.getByRole("checkbox", { name: "Show all" }));
    await waitFor(() => expect(mapRequests().length).toBeGreaterThan(before));
    expect(mapRequests().at(-1)).toBe("/api/snapshot/map?habitat=lunar&shown_psi_max=20");
  });

  it("asks for the full range when a custom target above 20 psi forces it", async () => {
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    fireEvent.change(await screen.findByLabelText("Pressure (psi)"), { target: { value: "30" } });
    await waitFor(() => expect(mapRequests()).toContain("/api/snapshot/map?habitat=custom&o2=21&psi=30&shown_psi_max=80"));
  });
});
