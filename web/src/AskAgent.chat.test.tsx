import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentChatProvider } from "./AgentChat";
import { AskAgent } from "./AskAgent";
import type { BlockSpec } from "./api";
import { explanationOk } from "./fixtures";

const block: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: 20 };

class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockExplain(body: unknown, status = 200) {
  const fn = vi.fn(async (url: string) => {
    if (url === "/api/agent/explain") return { ok: status === 200, status, json: async () => body };
    return { ok: false, status: 503, body: null };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.stubGlobal("ResizeObserver", QuietObserver));
afterEach(() => vi.unstubAllGlobals());

const wrap = (ui: React.ReactElement) => <AgentChatProvider>{ui}</AgentChatProvider>;
const ask = () => screen.getByRole("button", { name: "Ask Spark agent" });
const more = () => screen.getByRole("button", { name: "Ask more" });
const chat = () => screen.queryByRole("complementary", { name: "Spark agent chat" });

async function openExplanation() {
  fireEvent.click(ask());
  await screen.findByRole("button", { name: "Ask more" });
}

describe("Ask more", () => {
  it("is offered only under a checked explanation", async () => {
    mockExplain(explanationOk);
    render(wrap(<AskAgent block={block} />));
    expect(screen.queryByRole("button", { name: "Ask more" })).toBeNull();
    fireEvent.click(ask());
    expect(screen.queryByRole("button", { name: "Ask more" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Ask more" })).toBeInTheDocument();
  });

  it.each([
    [{ status: "unchecked" }, 200, "Spark agent could not give a checked explanation. Open Show the evidence instead."],
    [{ status: "busy" }, 503, "Spark agent is busy. Try again in a minute."],
    [{ status: "unavailable" }, 503, "Spark agent is not set up on this server."],
  ])("is not offered when the answer is %j", async (body, status, message) => {
    mockExplain(body, status);
    render(wrap(<AskAgent block={block} />));
    fireEvent.click(ask());
    await screen.findByText(message);
    expect(screen.queryByRole("button", { name: "Ask more" })).toBeNull();
  });

  it("opens the chat panel, starting from the explanation just shown", async () => {
    mockExplain(explanationOk);
    render(wrap(<AskAgent block={block} />));
    await openExplanation();
    expect(chat()).toBeNull();
    fireEvent.click(more());
    const panel = await screen.findByRole("complementary", { name: "Spark agent chat" });
    if (explanationOk.status !== "ok") throw new Error("fixture");
    expect(panel.textContent).toContain(explanationOk.answer.seeing);
    expect(more()).toHaveAttribute("aria-expanded", "true");
  });

  it("closes with the panel's Close button and gives focus back to Ask more", async () => {
    mockExplain(explanationOk);
    render(wrap(<AskAgent block={block} />));
    await openExplanation();
    fireEvent.click(more());
    fireEvent.click(within(await screen.findByRole("complementary", { name: "Spark agent chat" })).getByRole("button", { name: "Close" }));
    expect(chat()).toBeNull();
    await waitFor(() => expect(more()).toHaveFocus());
    expect(more()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes with Escape and gives focus back to Ask more", async () => {
    mockExplain(explanationOk);
    render(wrap(<AskAgent block={block} />));
    await openExplanation();
    fireEvent.click(more());
    fireEvent.keyDown(await screen.findByRole("complementary", { name: "Spark agent chat" }), { key: "Escape" });
    expect(chat()).toBeNull();
    await waitFor(() => expect(more()).toHaveFocus());
  });

  it("keeps the chat open when the explanation above it is closed, because the chat is its own panel", async () => {
    mockExplain(explanationOk);
    render(wrap(<AskAgent block={block} />));
    await openExplanation();
    fireEvent.click(more());
    await screen.findByRole("complementary", { name: "Spark agent chat" });
    fireEvent.click(ask());
    expect(chat()).not.toBeNull();
  });

  it("asks the chat route about the same block", async () => {
    const fn = mockExplain(explanationOk);
    render(wrap(<AskAgent block={block} />));
    await openExplanation();
    fireEvent.click(more());
    const panel = await screen.findByRole("complementary", { name: "Spark agent chat" });
    fireEvent.change(within(panel).getByRole("textbox"), { target: { value: "Why?" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(fn.mock.calls.some(([url]) => url === "/api/agent/chat")).toBe(true));
    const call = fn.mock.calls.find(([url]) => url === "/api/agent/chat") as unknown as [string, RequestInit];
    expect(JSON.parse(call[1].body as string).block).toEqual(block);
  });
});
