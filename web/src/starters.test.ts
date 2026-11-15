import { describe, expect, it } from "vitest";
import raw from "./starters.txt?raw";
import { startersFor } from "./starters";

describe("starter questions", () => {
  it.each([
    [{ kind: "map", habitat: "lunar" }, "What was tested in this atmosphere?"],
    [{ kind: "scenario", o2: 28, psi: 9 }, "What was tested close to this target?"],
    [{ kind: "ranking", habitat: "iss" }, "Which experiments come closest, and what did they burn?"],
    [{ kind: "experiment", experiment_id: "PSI-25" }, "What did this experiment burn, and where did it run?"],
  ] as const)("gives three questions for %j, starting with %s", (block, first) => {
    const questions = startersFor(block as never);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toBe(first);
  });

  it("reads them from a plain text file, one question to a line", () => {
    const lines = raw.split(String.fromCharCode(10)).filter(Boolean);
    expect(lines).toHaveLength(12);
    for (const line of lines) expect(line).toMatch(/^(map|scenario|ranking|experiment): .+\?$/);
  });

  it("keeps every question plain: under 20 words, no jargon", () => {
    for (const block of [{ kind: "map", habitat: "x" }, { kind: "scenario", o2: 1, psi: 1 }, { kind: "ranking", habitat: "x" }, { kind: "experiment", experiment_id: "PSI-1" }] as const) {
      for (const question of startersFor(block as never)) {
        expect(question.split(" ").length).toBeLessThan(20);
        expect(question).not.toMatch(/snapshot|loaded|per-test|distance/i);
      }
    }
  });
});
