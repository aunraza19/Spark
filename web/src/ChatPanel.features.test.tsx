import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAnswer, BlockSpec } from "./api";
import { ChatPanel } from "./ChatPanel";
import { startersFor } from "./starters";

const block: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: 20 };
const answer: AgentAnswer = { seeing: "Seen.", fire_safety: "Safe-ish.", cannot_tell: "Unknown.", sources: ["PSI-159"] };

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

const reply = (text: string) => sse([{ type: "text", delta: text }, { type: "done" }]);

class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => vi.stubGlobal("ResizeObserver", QuietObserver));
afterEach(() => vi.unstubAllGlobals());

const panel = () => screen.getByRole("complementary", { name: "Spark agent chat" });
const open = (props: { answer?: AgentAnswer } = {}) =>
  render(<ChatPanel block={block} label="lunar zone map" onClose={() => {}} {...props} />);

async function send(text: string) {
  fireEvent.change(within(panel()).getByRole("textbox"), { target: { value: text } });
  fireEvent.click(within(panel()).getByRole("button", { name: "Send" }));
}

describe("the context line", () => {
  it("says in one plain line what the chat is about", () => {
    open();
    expect(within(panel()).getByText("Talking about: lunar zone map")).toBeInTheDocument();
  });
});

describe("the welcome message and the starter questions", () => {
  it("welcomes the reader and offers three starter questions as buttons when nothing has been said", () => {
    open();
    const welcome = within(panel()).getByTestId("chat-welcome");
    expect(welcome).toHaveTextContent("Ask me about lunar zone map.");
    const buttons = within(welcome).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(startersFor(block));
    expect(buttons).toHaveLength(3);
  });

  it("is not shown when the chat starts from an explanation", () => {
    open({ answer });
    expect(within(panel()).queryByTestId("chat-welcome")).toBeNull();
  });

  it("sends a starter question when it is pressed, and then goes away", async () => {
    const fn = vi.fn(async () => reply("Gas flames."));
    vi.stubGlobal("fetch", fn);
    open();
    fireEvent.click(within(panel()).getByRole("button", { name: startersFor(block)[0] }));
    await within(panel()).findByText("Gas flames.");
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).messages.at(-1)).toEqual({ role: "user", text: startersFor(block)[0] });
    expect(within(panel()).queryByTestId("chat-welcome")).toBeNull();
  });

  it("starts a chat with no explanation from the user's first message", async () => {
    const fn = vi.fn(async () => reply("Ok."));
    vi.stubGlobal("fetch", fn);
    open();
    await send("How many tests?");
    await within(panel()).findByText("Ok.");
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).messages).toEqual([{ role: "user", text: "How many tests?" }]);
  });
});

describe("streaming, Stop, copy and regenerate", () => {
  it("shows Stop instead of Send while the reply is coming, and Stop ends it", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      }),
    );
    open();
    await send("Slow question");
    const stop = await within(panel()).findByRole("button", { name: "Stop" });
    expect(within(panel()).queryByRole("button", { name: "Send" })).toBeNull();
    fireEvent.click(stop);
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(await within(panel()).findByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("copies a reply", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.stubGlobal("fetch", vi.fn(async () => reply("Twenty tests.")));
    open();
    await send("How many?");
    await within(panel()).findByText("Twenty tests.");
    const message = within(panel()).getByText("Twenty tests.").closest(".chat-agent") as HTMLElement;
    fireEvent.click(within(message).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Twenty tests."));
  });

  it("regenerates a reply by asking the same question again", async () => {
    const fn = vi.fn(async (_url: string, _init: RequestInit) => reply("Again."));
    vi.stubGlobal("fetch", fn);
    open();
    await send("Why?");
    await within(panel()).findByText("Again.");
    fireEvent.click(within(panel()).getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    const bodies = fn.mock.calls.map(([, init]) => JSON.parse(init.body as string).messages);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it("offers Copy under the explanation it starts from, but not Regenerate", () => {
    open({ answer });
    const message = panel().querySelector(".chat-agent") as HTMLElement;
    expect(within(message).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    const regenerate = within(message).queryByRole("button", { name: "Regenerate" });
    expect(regenerate === null || (regenerate as HTMLButtonElement).disabled).toBe(true);
  });

  it("has a button that scrolls to the latest message, idle while the reader is at the end", () => {
    open({ answer });
    expect(within(panel()).getByRole("button", { name: "Scroll to latest" })).toBeDisabled();
  });
});

describe("markdown in replies", () => {
  it("shows lists and bold, and shows markup as text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply("Two kinds:\n\n- **Gas**: 20\n- Liquid: none\n\n<b>raw</b>")));
    open();
    await send("Kinds?");
    await within(panel()).findByText("Two kinds:");
    expect(within(panel()).getAllByRole("listitem")).toHaveLength(2);
    expect(within(panel()).getByText("Gas").tagName).toBe("STRONG");
    expect(panel().querySelector("b")).toBeNull();
    expect(within(panel()).getByText("<b>raw</b>")).toBeInTheDocument();
  });
});
