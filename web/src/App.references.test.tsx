import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { aboutFixture, gas, iss, liquid, lunar, lunarSnapshot, report, solid, spacesuit } from "./fixtures";

function mockApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/habitats") return ok([lunar, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url === "/api/about") return ok(aboutFixture);
      if (url.startsWith("/api/snapshot/map")) return ok({ key: "k", snapshot: lunarSnapshot });
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("reference points on the page's map", () => {
  it("draws the ISS cabin with its label while the lunar zone is chosen", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    const chart = screen.getByRole("group", { name: /oxygen against pressure/i });
    expect(within(chart).getByTestId("reference-marker")).toHaveTextContent("ISS cabin");
  });
});
