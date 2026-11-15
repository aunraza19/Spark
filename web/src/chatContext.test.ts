import { describe, expect, it } from "vitest";
import { describeBlock } from "./chatContext";
import { iss, lunar } from "./fixtures";

const habitats = [{ ...lunar, short_name: "lunar zone" }, iss];

describe("describeBlock", () => {
  it("names a zone map by its short name", () => {
    expect(describeBlock({ kind: "map", habitat: "lunar", shown_psi_max: 20 }, habitats)).toBe("lunar zone map");
  });

  it("names a point map by its label, and a habitat without a short name too", () => {
    expect(describeBlock({ kind: "map", habitat: "iss", shown_psi_max: 20 }, habitats)).toBe("ISS cabin map");
    expect(describeBlock({ kind: "map", habitat: "lunar" }, [lunar])).toBe("Lunar base or rover map");
  });

  it("names a custom target by its numbers", () => {
    expect(describeBlock({ kind: "map", habitat: "custom", o2: 28, psi: 9, shown_psi_max: 20 }, habitats)).toBe(
      "your target (28 % oxygen, 9 psi) map",
    );
    expect(describeBlock({ kind: "scenario", o2: 34, psi: 8.2 }, habitats)).toBe("your target (34 % oxygen, 8.2 psi)");
  });

  it("names a ranked list by its habitat", () => {
    expect(describeBlock({ kind: "ranking", habitat: "lunar" }, habitats)).toBe("the ranked list for lunar zone");
    expect(describeBlock({ kind: "ranking", habitat: "custom", o2: 28, psi: 9 }, habitats)).toBe(
      "the ranked list for your target (28 % oxygen, 9 psi)",
    );
  });

  it("names an experiment by its id", () => {
    expect(describeBlock({ kind: "experiment", experiment_id: "PSI-25" }, habitats)).toBe("experiment PSI-25");
  });

  it("falls back to the habitat id while the habitats have not loaded", () => {
    expect(describeBlock({ kind: "map", habitat: "lunar", shown_psi_max: 20 }, [])).toBe("lunar map");
  });
});
