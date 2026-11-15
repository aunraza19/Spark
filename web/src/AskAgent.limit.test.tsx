import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskAgent } from "./AskAgent";
import type { BlockSpec } from "./api";

const block: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: 20 };

afterEach(() => vi.unstubAllGlobals());

describe("AskAgent at the usage limit", () => {
  it("says Spark agent has reached its limit, as a plain message with no alert", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ status: "limited", message: "ignored" }) })));
    render(<AskAgent block={block} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Spark agent" }));
    expect(await screen.findByText("Spark agent has reached its limit for now. Try again later.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
