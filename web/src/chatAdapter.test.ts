import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockSpec } from "./api";
import { BUSY, makeAdapter, toFlat } from "./chatAdapter";

const block: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: 20 };
const user = (text: string) => ({ role: "user", content: [{ type: "text", text }] });
const assistant = (...content: unknown[]) => ({ role: "assistant", content });

function sse(events: unknown[], ok = true, status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return { ok, status, body };
}

async function run(messages: unknown[], reply: unknown) {
  const fn = vi.fn(async () => reply);
  vi.stubGlobal("fetch", fn);
  const out: { content: unknown[] }[] = [];
  const controller = new AbortController();
  const stream = makeAdapter(block).run({ messages, abortSignal: controller.signal } as never) as AsyncIterable<unknown>;
  for await (const result of stream) out.push(result as never);
  return { out, fn };
}

afterEach(() => vi.unstubAllGlobals());

describe("toFlat", () => {
  it("turns the thread into the flat messages the server reads", () => {
    const flat = toFlat([
      assistant({ type: "text", text: "Here is the explanation." }),
      user("How many tests?"),
      assistant(
        { type: "tool-call", toolCallId: "c1", toolName: "query_tests", args: { zone: "lunar" }, result: { count: 20 } },
        { type: "text", text: "Twenty." },
      ),
    ]);
    expect(flat).toEqual([
      { role: "assistant", text: "Here is the explanation.", tool_calls: [] },
      { role: "user", text: "How many tests?" },
      { role: "assistant", text: "", tool_calls: [{ id: "c1", name: "query_tests", args: { zone: "lunar" } }] },
      { role: "tool", tool_call_id: "c1", content: JSON.stringify({ count: 20 }) },
      { role: "assistant", text: "Twenty.", tool_calls: [] },
    ]);
  });

  it("keeps a string tool result as it is", () => {
    const flat = toFlat([user("Q"), assistant({ type: "tool-call", toolCallId: "c", toolName: "get_experiment", args: {}, result: "plain" })]);
    expect(flat.at(-1)).toEqual({ role: "tool", tool_call_id: "c", content: "plain" });
  });
});

describe("the adapter", () => {
  it("posts the block description and the flat messages, and nothing from the screen", async () => {
    const { fn } = await run([assistant({ type: "text", text: "Explanation" }), user("Why?")], sse([{ type: "done" }]));
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/agent/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      block,
      messages: [{ role: "assistant", text: "Explanation", tool_calls: [] }, { role: "user", text: "Why?" }],
    });
  });

  it("streams text as it arrives, growing one text part", async () => {
    const { out } = await run([user("Hi")], sse([{ type: "text", delta: "Hel" }, { type: "text", delta: "lo." }, { type: "done" }]));
    expect(out.map((r) => r.content)).toEqual([[{ type: "text", text: "Hel" }], [{ type: "text", text: "Hello." }], [{ type: "text", text: "Hello." }]]);
  });

  it("shows the model's reasoning as its own part, growing as it arrives, before the answer", async () => {
    const { out } = await run(
      [user("Hi")],
      sse([{ type: "reasoning", delta: "Look at " }, { type: "reasoning", delta: "the zone." }, { type: "text", delta: "Done." }, { type: "done" }]),
    );
    expect(out.at(-1)!.content).toEqual([
      { type: "reasoning", text: "Look at the zone." },
      { type: "text", text: "Done." },
    ]);
  });

  it("never sends the reasoning back to the server", () => {
    const flat = toFlat([user("Hi"), assistant({ type: "reasoning", text: "secret thoughts" }, { type: "text", text: "Hello." })]);
    expect(JSON.stringify(flat)).not.toContain("secret thoughts");
  });

  it("shows a tool call, then fills in its result", async () => {
    const result = JSON.stringify({ count: 20, by_experiment: { "PSI-159": 20 }, source: "test_points.json" });
    const { out } = await run(
      [user("How many?")],
      sse([
        { type: "tool_call", id: "c1", name: "query_tests", args: { zone: "lunar" } },
        { type: "tool_result", id: "c1", name: "query_tests", result },
        { type: "text", delta: "Twenty." },
        { type: "done" },
      ]),
    );
    const last = out.at(-1)!.content as { type: string; text?: string }[];
    expect(last[0]).toMatchObject({ type: "tool-call", toolCallId: "c1", toolName: "query_tests", args: { zone: "lunar" }, result: JSON.parse(result) });
    expect(last[1]).toEqual({ type: "text", text: "Twenty." });
  });

  it("turns an error event into a plain message, not a thrown error", async () => {
    const { out } = await run([user("Hi")], sse([{ type: "error", message: BUSY }]));
    expect(out.at(-1)!.content).toEqual([{ type: "text", text: BUSY }]);
  });

  it("says Spark agent is busy when the server refuses", async () => {
    const refused = await run([user("Hi")], { ok: false, status: 503, body: null });
    expect(refused.out.at(-1)!.content).toEqual([{ type: "text", text: BUSY }]);
  });

  it("says Spark agent is busy when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const out: { content: unknown[] }[] = [];
    const stream = makeAdapter(block).run({ messages: [user("Hi")], abortSignal: new AbortController().signal } as never) as AsyncIterable<unknown>;
    for await (const r of stream) out.push(r as never);
    expect(out.at(-1)!.content).toEqual([{ type: "text", text: BUSY }]);
  });
});
