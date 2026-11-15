import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HabitatSelector } from "./HabitatSelector";
import { iss, lunar, spacesuit } from "./fixtures";

const habitats = [lunar, iss, spacesuit];

function setup(selection = { habitatId: "lunar" } as { habitatId: string; custom?: { o2: number; psi: number } }) {
  const onChange = vi.fn();
  render(<HabitatSelector habitats={habitats} selection={selection} onChange={onChange} />);
  return onChange;
}

describe("HabitatSelector", () => {
  it("offers the ISS cabin, the lunar base or rover, and a custom habitat", () => {
    setup();
    expect(screen.getByRole("radio", { name: "ISS cabin" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Lunar base or rover" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Custom" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("shows the spacesuit only as a note, with its numbers and source", () => {
    setup();
    expect(screen.queryByRole("radio", { name: /spacesuit/i })).toBeNull();
    const note = screen.getByText(/Spacesuit/);
    expect(note.textContent).toContain("100");
    expect(note.textContent).toContain("4.3");
    expect(note.textContent).toContain("Challenge text");
  });

  it("describes the selected zone with its numbers and source from the data", () => {
    setup();
    const text = screen.getByTestId("habitat-description").textContent ?? "";
    expect(text).toContain("30 %");
    expect(text).toContain("10.2 psi");
    expect(text).toContain("Source: Challenge text");
  });

  it("describes a point habitat as one reference point", () => {
    setup({ habitatId: "iss" });
    const text = screen.getByTestId("habitat-description").textContent ?? "";
    expect(text).toContain("21 %");
    expect(text).toContain("14.7 psi");
    expect(text).toContain("Source: Researcher's Guide, page 19");
  });

  it("reports the choice when another habitat is picked", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("radio", { name: "ISS cabin" }));
    expect(onChange).toHaveBeenCalledWith({ habitatId: "iss" });
  });

  it("shows oxygen and pressure fields once Custom is chosen", () => {
    setup({ habitatId: "custom", custom: { o2: 28, psi: 9 } });
    expect(screen.getByLabelText("Oxygen (%)")).toHaveValue(28);
    expect(screen.getByLabelText("Pressure (psi)")).toHaveValue(9);
  });

  it("reports valid custom numbers", () => {
    const onChange = setup({ habitatId: "custom", custom: { o2: 28, psi: 9 } });
    fireEvent.change(screen.getByLabelText("Pressure (psi)"), { target: { value: "9.5" } });
    expect(onChange).toHaveBeenLastCalledWith({ habitatId: "custom", custom: { o2: 28, psi: 9.5 } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["Oxygen (%)", "0"],
    ["Oxygen (%)", "101"],
    ["Oxygen (%)", ""],
    ["Pressure (psi)", "0"],
    ["Pressure (psi)", "-3"],
    ["Pressure (psi)", ""],
  ])("rejects %s = '%s' with a message and reports nothing", (label, value) => {
    const onChange = setup({ habitatId: "custom", custom: { o2: 28, psi: 9 } });
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("starts the custom fields from the last custom numbers or from the ISS point", () => {
    const onChange = setup({ habitatId: "lunar" });
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    expect(onChange).toHaveBeenCalledWith({ habitatId: "custom", custom: { o2: 21, psi: 14.7 } });
  });
});
