import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlameDrop } from "./FlameDrop";
import { makeRecorder, texts, type Recorder } from "./recorder";

let recorder: Recorder;
let queue: FrameRequestCallback[];
let now: number;

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function runFrames() {
  const pending = queue.splice(0);
  pending.forEach((callback) => callback(now));
}

beforeEach(() => {
  recorder = makeRecorder();
  queue = [];
  now = 10000;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => recorder.ctx as never);
  Object.defineProperty(HTMLCanvasElement.prototype, "clientWidth", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLCanvasElement.prototype, "clientHeight", { configurable: true, get: () => 400 });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  setReducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FlameDrop", () => {
  it("describes the picture for screen readers", () => {
    render(<FlameDrop />);
    expect(screen.getByRole("img", { name: /two flames/i })).toBeInTheDocument();
  });

  it("is labelled as an illustration, not data", () => {
    render(<FlameDrop />);
    expect(screen.getByText("Illustration, not data")).toBeInTheDocument();
  });

  it("gives each flame its caption", () => {
    render(<FlameDrop />);
    expect(screen.getByText("On Earth: hot gas rises, the flame is a tall teardrop.")).toBeInTheDocument();
    expect(screen.getByText("On the ISS: nothing rises, the flame is a dim sphere.")).toBeInTheDocument();
  });

  it("offers a Replay the drop button", () => {
    render(<FlameDrop />);
    expect(screen.getByRole("button", { name: "Replay the drop" })).toBeEnabled();
  });

  it("draws the drop: the right flame ends at about 0 g", () => {
    render(<FlameDrop />);
    now = 14000;
    runFrames();
    expect(texts(recorder).slice(-2)).toEqual(["1 g", "about 0 g"]);
  });

  it("restarts the drop when Replay the drop is pressed", () => {
    render(<FlameDrop />);
    now = 14000;
    runFrames();
    fireEvent.click(screen.getByRole("button", { name: "Replay the drop" }));
    recorder.calls.length = 0;
    runFrames();
    expect(texts(recorder).slice(-2)).toEqual(["1 g", "1.00 g"]);
  });

  it("hides the replay button and draws one still picture with reduced motion", () => {
    setReducedMotion(true);
    render(<FlameDrop />);
    expect(screen.queryByRole("button", { name: "Replay the drop" })).toBeNull();
    runFrames();
    expect(texts(recorder).slice(-2)).toEqual(["1 g", "about 0 g"]);
    expect(queue).toHaveLength(0);
  });

  it("stops its animation when it is removed", () => {
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { unmount } = render(<FlameDrop />);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
