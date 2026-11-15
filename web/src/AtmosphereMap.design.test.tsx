import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtmosphereMap } from "./AtmosphereMap";
import { custom, gas, iss, liquid, lunar, report, solid, spacesuit } from "./fixtures";
import { mapScales } from "./scale";

const points = [gas, liquid, solid];

type Callback = (entries: { contentRect: { width: number } }[]) => void;
function stubResizeObserver() {
  const holder: { callback?: Callback } = {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: Callback) {
        holder.callback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  return (width: number) => act(() => holder.callback?.([{ contentRect: { width } }]));
}

afterEach(() => vi.unstubAllGlobals());

const chart = () => screen.getByRole("group", { name: /oxygen against pressure/i });

describe("the map is drawn at the real width of its box", () => {
  it("keeps the default drawing until a width is measured", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    expect(chart().getAttribute("viewBox")).toBe("0 0 640 420");
  });

  it("draws one unit per pixel at a wide width, so 14 px labels stay 14 px", () => {
    const resize = stubResizeObserver();
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    resize(1120);
    expect(chart().getAttribute("viewBox")).toBe("0 0 1120 560");
  });

  it("draws a taller map on a phone", () => {
    const resize = stubResizeObserver();
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    resize(358);
    expect(chart().getAttribute("viewBox")).toBe("0 0 358 448");
  });

  it("moves the marks and the zone with the width", () => {
    const resize = stubResizeObserver();
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    resize(358);
    const { x } = mapScales("full", { width: 358, height: 448 });
    expect(Number(screen.getByTestId("zone").getAttribute("width"))).toBeCloseTo(x(10.2) - x(0));
  });
});

describe("the zone is named inside the chart", () => {
  it("says the zone and its two limits, from the habitat data", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    const label = screen.getByTestId("zone-label");
    expect(within(label).getByText("Lunar base or rover")).toBeInTheDocument();
    expect(within(label).getByText("30 % oxygen or more")).toBeInTheDocument();
    expect(within(label).getByText("10.2 psi or less")).toBeInTheDocument();
  });

  it("uses the short name when the habitat has one", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={{ ...lunar, short_name: "lunar zone" }} />);
    expect(within(screen.getByTestId("zone-label")).getByText("Lunar zone")).toBeInTheDocument();
  });

  it("sits inside the shaded zone", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} />);
    const zone = screen.getByTestId("zone");
    const label = screen.getByTestId("zone-label");
    const zx = Number(zone.getAttribute("x"));
    const zy = Number(zone.getAttribute("y"));
    expect(Number(label.getAttribute("x"))).toBeGreaterThan(zx);
    expect(Number(label.getAttribute("x"))).toBeLessThan(zx + Number(zone.getAttribute("width")));
    expect(Number(label.getAttribute("y"))).toBeGreaterThan(zy);
    expect(Number(label.getAttribute("y"))).toBeLessThan(zy + Number(zone.getAttribute("height")));
  });

  it("is absent when the target is a point", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={iss} />);
    expect(screen.queryByTestId("zone-label")).toBeNull();
  });
});

describe("targets and presets are labelled on the chart", () => {
  it("labels the ISS cabin point", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={iss} />);
    expect(within(screen.getByTestId("habitat-marker")).getByText("ISS cabin")).toBeInTheDocument();
  });

  it("labels a custom target as your target", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={custom} />);
    expect(within(screen.getByTestId("habitat-marker")).getByText("Your target")).toBeInTheDocument();
  });

  it("labels a report condition that is a preset", () => {
    render(<AtmosphereMap points={points} reportConditions={[report]} habitat={lunar} />);
    expect(within(screen.getByTestId("report-condition")).getByText("NASA test atmosphere")).toBeInTheDocument();
  });

  it("does not label a report condition that is not a preset", () => {
    render(<AtmosphereMap points={points} reportConditions={[{ ...report, preset_label: undefined }]} habitat={lunar} />);
    expect(within(screen.getByTestId("report-condition")).queryByText("NASA test atmosphere")).toBeNull();
  });

  it("draws the other point habitats as labelled references, not the zone or the note", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={lunar} references={[lunar, iss, spacesuit]} />);
    const references = screen.getAllByTestId("reference-marker");
    expect(references).toHaveLength(1);
    expect(within(references[0]).getByText("ISS cabin")).toBeInTheDocument();
  });

  it("does not draw the selected point twice", () => {
    render(<AtmosphereMap points={points} reportConditions={[]} habitat={iss} references={[lunar, iss, spacesuit]} />);
    expect(screen.queryAllByTestId("reference-marker")).toHaveLength(0);
    expect(screen.getAllByTestId("habitat-marker")).toHaveLength(1);
  });
});

describe("the key under the chart", () => {
  it("names the shape of each fuel and the black solid triangle", () => {
    render(<AtmosphereMap points={points} reportConditions={[report]} habitat={lunar} />);
    const key = within(screen.getByRole("list", { name: "Legend" }));
    for (const text of [/Gas \(circle\)/, /Liquid \(square\)/, /Solid \(black triangle\)/, /Report condition \(diamond\)/]) {
      expect(key.getByText(text)).toBeInTheDocument();
    }
  });
});
