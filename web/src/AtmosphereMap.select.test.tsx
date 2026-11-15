import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AtmosphereMap } from "./AtmosphereMap";
import { gas, liquid, report, solid } from "./fixtures";

const HINT = "Click a mark, or press Tab and use the arrow keys, then Enter.";

function setup() {
  const onSelect = vi.fn();
  render(<AtmosphereMap points={[solid, liquid, gas]} reportConditions={[report]} habitat={null} onSelect={onSelect} />);
  const marks = screen.getAllByRole("button");
  const byName = (text: string) => marks.find((m) => m.getAttribute("aria-label")?.startsWith(text)) as Element;
  return { onSelect, marks, gasMark: byName("PSI-159"), reportMark: byName("PSI-20"), liquidMark: byName("PSI-69"), solidMark: byName("PSI-25") };
}

describe("AtmosphereMap marks you can choose", () => {
  it("leaves the marks plain, with no buttons and no hint, when nothing listens", () => {
    render(<AtmosphereMap points={[gas]} reportConditions={[report]} habitat={null} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("makes every test point and report condition a button named with its test and conditions", () => {
    const { marks, gasMark } = setup();
    expect(marks).toHaveLength(4);
    expect(gasMark.getAttribute("aria-label")).toContain("test 21088A1");
    expect(gasMark.getAttribute("aria-label")).toContain("39.39 % oxygen");
  });

  it("explains how to use the keyboard, in one line", () => {
    setup();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("asks for the card of a test point by its source file and row", () => {
    const { onSelect, gasMark } = setup();
    fireEvent.click(gasMark);
    expect(onSelect).toHaveBeenCalledWith({ source_file: gas.source_file, source_row: 2 });
  });

  it("asks for the card of a report condition by experiment and test id", () => {
    const { onSelect, reportMark } = setup();
    fireEvent.click(reportMark);
    expect(onSelect).toHaveBeenCalledWith({ experiment_id: "PSI-20", test_id: "19070D1" });
  });

  it("opens on Enter and on Space, not on other keys", () => {
    const { onSelect, liquidMark } = setup();
    fireEvent.keyDown(liquidMark, { key: "a" });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(liquidMark, { key: "Enter" });
    fireEvent.keyDown(liquidMark, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith({ source_file: liquid.source_file, source_row: 38 });
  });

  it("is one stop in the tab order, so 4 marks do not take 4 tabs", () => {
    const { marks } = setup();
    expect(marks.filter((m) => m.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(marks.filter((m) => m.getAttribute("tabindex") === "-1")).toHaveLength(3);
  });

  it("moves along the marks from low pressure to high with the arrow keys", () => {
    const { gasMark, reportMark, liquidMark, solidMark } = setup();
    (gasMark as HTMLElement).focus();
    fireEvent.keyDown(gasMark, { key: "ArrowRight" });
    expect(document.activeElement).toBe(reportMark);
    fireEvent.keyDown(reportMark, { key: "ArrowDown" });
    expect(document.activeElement).toBe(liquidMark);
    fireEvent.keyDown(liquidMark, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(reportMark);
    fireEvent.keyDown(reportMark, { key: "End" });
    expect(document.activeElement).toBe(solidMark);
    fireEvent.keyDown(solidMark, { key: "Home" });
    expect(document.activeElement).toBe(gasMark);
  });

  it("stays on the first and last marks instead of wrapping", () => {
    const { gasMark, solidMark } = setup();
    (gasMark as HTMLElement).focus();
    fireEvent.keyDown(gasMark, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(gasMark);
    (solidMark as HTMLElement).focus();
    fireEvent.keyDown(solidMark, { key: "ArrowRight" });
    expect(document.activeElement).toBe(solidMark);
  });

  it("carries the tab stop to the mark that has focus", () => {
    const { gasMark, reportMark } = setup();
    (gasMark as HTMLElement).focus();
    fireEvent.keyDown(gasMark, { key: "ArrowRight" });
    expect(reportMark).toHaveAttribute("tabindex", "0");
    expect(gasMark).toHaveAttribute("tabindex", "-1");
  });
});
