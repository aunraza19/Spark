import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("shows the project title as the main heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Flame in Freefall" })).toBeInTheDocument();
  });
});
