import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskAgent } from "./AskAgent";
import type { BlockSpec } from "./api";
import { explanationOk } from "./fixtures";

const block: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: 20 };
const NOTE = "Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.";

function mockReply(body: unknown, status = 200) {
  const fn = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const ask = () => screen.getByRole("button", { name: "Ask Spark agent" });

describe("AskAgent", () => {
  it("is a button, with no panel and no request until it is pressed", () => {
    const fn = mockReply(explanationOk);
    render(<AskAgent block={block} />);
    expect(ask()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Spark agent explanation" })).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("sends the block description, never text from the screen", async () => {
    const fn = mockReply(explanationOk);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    await screen.findByText(explanationOk.status === "ok" ? explanationOk.answer.seeing : "");
    expect(fn).toHaveBeenCalledTimes(1);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/agent/explain");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ block });
  });

  it("says Spark agent is reading this block while it works", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    const panel = screen.getByRole("region", { name: "Spark agent explanation" });
    expect(within(panel).getByText("Spark agent is reading this block.")).toBeInTheDocument();
    expect(ask()).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the four parts under their headings, with the sources as links to the experiment pages", async () => {
    mockReply(explanationOk);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    const panel = await screen.findByRole("region", { name: "Spark agent explanation" });
    await within(panel).findByRole("heading", { name: "What you are seeing" });
    for (const heading of ["What it means for fire safety", "What the data cannot tell you", "Sources"]) {
      expect(within(panel).getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    if (explanationOk.status !== "ok") throw new Error("fixture");
    for (const text of [explanationOk.answer.seeing, explanationOk.answer.fire_safety, explanationOk.answer.cannot_tell]) {
      expect(within(panel).getByText(text)).toBeInTheDocument();
    }
    expect(within(panel).getByRole("link", { name: "PSI-159" })).toHaveAttribute("href", "#experiment/PSI-159");
    expect(within(panel).getByRole("link", { name: "PSI-20" })).toHaveAttribute("href", "#experiment/PSI-20");
  });

  it("says under every answer that it is an AI and to check the evidence", async () => {
    mockReply(explanationOk);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    expect(await screen.findByText(NOTE)).toBeInTheDocument();
  });

  it("shows the answer as plain text, not as markup", async () => {
    mockReply({ ...explanationOk, answer: { ...(explanationOk.status === "ok" ? explanationOk.answer : ({} as never)), seeing: "<b>bold</b> and <img src=x>" } });
    const { container } = render(<AskAgent block={block} />);
    fireEvent.click(ask());
    expect(await screen.findByText("<b>bold</b> and <img src=x>")).toBeInTheDocument();
    expect(container.querySelector("b, img")).toBeNull();
  });

  it("says in plain words when no checked explanation could be given, pointing to the evidence", async () => {
    mockReply({ status: "unchecked" });
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    expect(await screen.findByText("Spark agent could not give a checked explanation. Open Show the evidence instead.")).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it("says Spark agent is busy on a rate limit, never leaving the panel silent", async () => {
    mockReply({ status: "busy" }, 503);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    expect(await screen.findByText("Spark agent is busy. Try again in a minute.")).toBeInTheDocument();
    expect(screen.queryByText("Spark agent is reading this block.")).toBeNull();
  });

  it("says the same when the network fails or the server sends something unexpected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    expect(await screen.findByText("Spark agent is busy. Try again in a minute.")).toBeInTheDocument();
  });

  it("says when the server has no model access", async () => {
    mockReply({ status: "unavailable" }, 503);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    expect(await screen.findByText("Spark agent is not set up on this server.")).toBeInTheDocument();
  });

  it("raises no alert for any of these messages", async () => {
    mockReply({ status: "busy" }, 503);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    await screen.findByText("Spark agent is busy. Try again in a minute.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("closes on a second press, and asks again on a third", async () => {
    const fn = mockReply({ status: "busy" }, 503);
    render(<AskAgent block={block} />);
    fireEvent.click(ask());
    await screen.findByText("Spark agent is busy. Try again in a minute.");
    fireEvent.click(ask());
    expect(screen.queryByRole("region", { name: "Spark agent explanation" })).toBeNull();
    expect(ask()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(ask());
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  it("closes when the block changes, so an answer is never shown for another block", async () => {
    mockReply(explanationOk);
    const { rerender } = render(<AskAgent block={block} />);
    fireEvent.click(ask());
    await screen.findByText(NOTE);
    rerender(<AskAgent block={{ kind: "map", habitat: "iss", shown_psi_max: 20 }} />);
    expect(screen.queryByRole("region", { name: "Spark agent explanation" })).toBeNull();
    expect(ask()).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores a late answer for a block that is no longer open", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => (resolve = r))));
    const { rerender } = render(<AskAgent block={block} />);
    fireEvent.click(ask());
    rerender(<AskAgent block={{ kind: "map", habitat: "iss", shown_psi_max: 20 }} />);
    resolve({ ok: true, status: 200, json: async () => explanationOk });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
