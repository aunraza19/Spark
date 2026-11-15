import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Evidence } from "./Evidence";

describe("Evidence", () => {
  it("is a closed details control named Show the evidence", () => {
    render(
      <Evidence>
        <p>the table</p>
      </Evidence>,
    );
    const summary = screen.getByText("Show the evidence");
    expect(summary.tagName).toBe("SUMMARY");
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
  });

  it("holds its children inside the details", () => {
    render(
      <Evidence>
        <p>the table</p>
      </Evidence>,
    );
    expect(screen.getByText("the table").closest("details")).toBe(screen.getByText("Show the evidence").closest("details"));
  });
});
