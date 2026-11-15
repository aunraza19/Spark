import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAnswer, BlockSpec } from "./api";
import { ChatPanel } from "./ChatPanel";

const block: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: 20 };
const NOTE = "Spark agent, an AI. Generated from NASA PSI data. Check the evidence before relying on it.";
const NOT_CHECKED = "Answers in the chat are not checked like the explanation above. Check the evidence.";
const BUSY = "Spark agent is busy. Try again in a minute.";

const answer: AgentAnswer = {
  seeing: "There are 20 tests inside the lunar zone.",
  fire_safety: "They burned a gas flame on a burner.",
  cannot_tell: "The data does not show solid material here.",
  sources: ["PSI-159", "PSI-20"],
};

function sse(events: unknown[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

function mockChat(reply: unknown) {
  const fn = vi.fn(async () => reply);
  vi.stubGlobal("fetch", fn);
  return fn;
}

class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => vi.stubGlobal("ResizeObserver", QuietObserver));
afterEach(() => vi.unstubAllGlobals());

const panel = () => screen.getByRole("complementary", { name: "Spark agent chat" });

async function ask(question: string) {
  const input = within(panel()).getByRole("textbox");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.click(within(panel()).getByRole("button", { name: "Send" }));
}

describe("ChatPanel", () => {
  it("is a side panel named Spark agent chat, with a Close button", () => {
    const onClose = vi.fn();
    render(<ChatPanel block={block} answer={answer} onClose={onClose} />);
    expect(within(panel()).getByRole("heading", { name: "Spark agent chat" })).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ChatPanel block={block} answer={answer} onClose={onClose} />);
    fireEvent.keyDown(panel(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts with the checked explanation as the first message, with its sources", () => {
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    const text = panel().textContent ?? "";
    for (const part of [answer.seeing, answer.fire_safety, answer.cannot_tell]) expect(text).toContain(part);
    expect(text).toContain("PSI-159, PSI-20");
  });

  it("puts the Spark agent label under every reply, the first one included", () => {
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    expect(within(panel()).getAllByText(NOTE)).toHaveLength(1);
  });

  it("says under the input that chat answers are not checked", () => {
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    expect(within(panel()).getByText(NOT_CHECKED)).toBeInTheDocument();
  });

  it("has an input and a Send button", () => {
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    expect(within(panel()).getByRole("textbox")).toHaveAttribute("placeholder", "Ask a follow-up question");
    expect(within(panel()).getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("sends the block, the explanation and the question, and streams the reply with its label", async () => {
    const fn = mockChat(sse([{ type: "text", delta: "Twenty " }, { type: "text", delta: "tests." }, { type: "done" }]));
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    await ask("How many are gas?");
    await within(panel()).findByText("Twenty tests.");
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/agent/chat");
    const body = JSON.parse(init.body as string);
    expect(body.block).toEqual(block);
    expect(body.messages.at(-1)).toEqual({ role: "user", text: "How many are gas?" });
    expect(body.messages[0].role).toBe("assistant");
    expect(body.messages[0].text).toContain(answer.seeing);
    expect(within(panel()).getAllByText(NOTE)).toHaveLength(2);
    expect(within(panel()).getByText("How many are gas?")).toBeInTheDocument();
  });

  it("shows a small card for a tool result", async () => {
    const result = JSON.stringify({ count: 20, by_experiment: { "PSI-159": 20 }, source: "data/clean/test_points.json" });
    mockChat(
      sse([
        { type: "tool_call", id: "c1", name: "query_tests", args: { zone: "lunar" } },
        { type: "tool_result", id: "c1", name: "query_tests", result },
        { type: "text", delta: "That is 20." },
        { type: "done" },
      ]),
    );
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    await ask("How many in the lunar zone?");
    const card = await within(panel()).findByTestId("tool-card");
    await waitFor(() => expect(card).toHaveTextContent("20 tests"));
    expect(card).toHaveTextContent("Asked for: zone lunar");
    expect(within(panel()).getByText("That is 20.")).toBeInTheDocument();
  });

  it("says Spark agent is busy when the server is busy, with no alert", async () => {
    mockChat({ ok: false, status: 503, body: null });
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    await ask("Anything?");
    expect(await within(panel()).findByText(BUSY)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says it as a plain message when the stream carries an error event", async () => {
    mockChat(sse([{ type: "error", message: BUSY }]));
    render(<ChatPanel block={block} answer={answer} onClose={() => {}} />);
    await ask("Anything?");
    expect(await within(panel()).findByText(BUSY)).toBeInTheDocument();
  });
});
