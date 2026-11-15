import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutFooter } from "./AboutFooter";
import { aboutFixture } from "./fixtures";

describe("AboutFooter", () => {
  it("is a footer with the heading About the data", () => {
    render(<AboutFooter about={aboutFixture} />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "About the data" })).toBeInTheDocument();
  });

  it("lists every source with its count and its file", () => {
    render(<AboutFooter about={aboutFixture} />);
    const list = within(screen.getByRole("list", { name: "Sources" }));
    expect(list.getByText(/Test points: 878/)).toHaveTextContent("data/clean/test_points.json");
    expect(list.getByText(/Report conditions: 3/)).toHaveTextContent("BRE_final_report_20220201.pdf");
    expect(list.getByText(/Experiment records: 24/)).toBeInTheDocument();
  });

  it("gives the data version and the rule for distance, words kept out of the main page", () => {
    render(<AboutFooter about={aboutFixture} />);
    expect(screen.getByText(/Data version abc123def456/)).toBeInTheDocument();
    expect(screen.getByTestId("about-rule")).toHaveTextContent(aboutFixture.distance_rule);
  });

  it("lists the known data problems", () => {
    render(<AboutFooter about={aboutFixture} />);
    const list = within(screen.getByRole("list", { name: "Known data problems" }));
    expect(list.getAllByRole("listitem")).toHaveLength(2);
    expect(list.getByText("263 burner-oxygen points are kept off the map.")).toBeInTheDocument();
  });

  it("says it is loading while the notes arrive", () => {
    render(<AboutFooter about={null} />);
    expect(screen.getByText("Loading the notes about the data...")).toBeInTheDocument();
  });

  it("says in plain words when the notes could not be loaded, without raising an alert", () => {
    render(<AboutFooter about={null} failed />);
    expect(screen.getByText("The notes about the data could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
