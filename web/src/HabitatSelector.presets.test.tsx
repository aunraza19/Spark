import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Preset } from "./api";
import { iss, lunar, spacesuit } from "./fixtures";
import { HabitatSelector } from "./HabitatSelector";

const nasa: Preset = {
  label: "NASA test atmosphere",
  o2: 34,
  psi: 8.2,
  source: "BRE_final_report_20220201.pdf, page 26, Figure 9",
};

function setup(presets: Preset[] = [nasa], selection = { habitatId: "lunar" } as { habitatId: string; custom?: { o2: number; psi: number } }) {
  const onChange = vi.fn();
  render(<HabitatSelector habitats={[lunar, iss, spacesuit]} selection={selection} onChange={onChange} presets={presets} />);
  return onChange;
}

describe("HabitatSelector presets", () => {
  it("shows the source of each habitat when the pointer rests on it", () => {
    setup();
    expect(screen.getByRole("radio", { name: "ISS cabin" }).closest("label")).toHaveAttribute("title", "Source: Researcher's Guide, page 19");
    expect(screen.getByRole("radio", { name: "Lunar base or rover" }).closest("label")?.getAttribute("title")).toContain("Challenge text");
  });

  it("offers a NASA test atmosphere preset with its numbers and its source on hover", () => {
    setup();
    const button = screen.getByRole("button", { name: "NASA test atmosphere (34 %, 8.2 psi)" });
    expect(button).toHaveAttribute("title", "Source: BRE_final_report_20220201.pdf, page 26, Figure 9");
  });

  it("sets the custom target to the preset's numbers in one click", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "NASA test atmosphere (34 %, 8.2 psi)" }));
    expect(onChange).toHaveBeenCalledWith({ habitatId: "custom", custom: { o2: 34, psi: 8.2 } });
  });

  it("marks the preset as pressed when the custom target matches it", () => {
    setup([nasa], { habitatId: "custom", custom: { o2: 34, psi: 8.2 } });
    expect(screen.getByRole("button", { name: /NASA test atmosphere/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not mark it as pressed for other numbers", () => {
    setup([nasa], { habitatId: "custom", custom: { o2: 28, psi: 9 } });
    expect(screen.getByRole("button", { name: /NASA test atmosphere/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows no preset button when the data has none", () => {
    setup([]);
    expect(screen.queryByRole("button", { name: /NASA test atmosphere/ })).toBeNull();
  });
});
