import { describe, expect, it } from "vitest";
import { CAPTIONS, ILLUSTRATION_LABEL, LEDE, THREE_LINES } from "./content";

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const all = [LEDE, CAPTIONS.earth, CAPTIONS.iss, ...THREE_LINES.map((l) => l.text)];

describe("page copy", () => {
  it("has a one-sentence lede", () => {
    expect(LEDE.length).toBeGreaterThan(0);
    expect(sentences(LEDE)).toHaveLength(1);
  });

  it("gives the two flames the captions from the brief", () => {
    expect(CAPTIONS.earth).toBe("On Earth: hot gas rises, the flame is a tall teardrop.");
    expect(CAPTIONS.iss).toBe("On the ISS: nothing rises, the flame is a dim sphere.");
  });

  it("labels the animation as an illustration", () => {
    expect(ILLUSTRATION_LABEL).toBe("Illustration, not data");
  });

  it("states the question in three lines: what NASA tested, what we built, why it matters", () => {
    expect(THREE_LINES.map((l) => l.label)).toEqual(["What NASA tested", "What we built", "Why it matters"]);
  });

  it("keeps every sentence under 20 words", () => {
    for (const text of all) for (const sentence of sentences(text)) expect(sentence.split(/\s+/).length).toBeLessThan(20);
  });

  it("uses no numbers and none of the banned words", () => {
    for (const text of all) {
      expect(text).not.toMatch(/\d/);
      for (const banned of ["AI-powered", "snapshot", "data version", "distance"]) expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});
