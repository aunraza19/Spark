import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("formatNumber", () => {
  it.each([
    [10.332, "10.33"],
    [34, "34"],
    [17.9685675, "17.97"],
    [0.132, "0.13"],
    [7.3481, "7.35"],
    [14.7, "14.7"],
  ])("shows %s as %s", (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});
