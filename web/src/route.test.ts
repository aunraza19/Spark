import { describe, expect, it } from "vitest";
import { experimentHref, parseRoute } from "./route";

describe("parseRoute", () => {
  it.each(["", "#", "#map", "#nonsense", "#experiment", "#experiment/"])("takes %j to the map page", (hash) => {
    expect(parseRoute(hash)).toEqual({ kind: "home" });
  });

  it("takes #experiments to the list", () => {
    expect(parseRoute("#experiments")).toEqual({ kind: "experiments" });
  });

  it("takes #experiment/PSI-25 to that experiment", () => {
    expect(parseRoute("#experiment/PSI-25")).toEqual({ kind: "experiment", id: "PSI-25" });
  });

  it("keeps an id that does not exist, so the page can say so", () => {
    expect(parseRoute("#experiment/PSI-999")).toEqual({ kind: "experiment", id: "PSI-999" });
  });
});

describe("experimentHref", () => {
  it("makes the shareable address of an experiment", () => {
    expect(experimentHref("PSI-25")).toBe("#experiment/PSI-25");
    expect(parseRoute(experimentHref("PSI-159"))).toEqual({ kind: "experiment", id: "PSI-159" });
  });
});
