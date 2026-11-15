import type { ChatModelAdapter, ThreadAssistantMessagePart } from "@assistant-ui/react";
import type { BlockSpec } from "./api";

export const BUSY = "Spark agent is busy. Try again in a minute.";

export type Flat =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; tool_calls: { id: string; name: string; args: unknown }[] }
  | { role: "tool"; tool_call_id: string; content: string };

type Part = { type: string; text?: string; toolCallId?: string; toolName?: string; args?: unknown; result?: unknown };
type Message = { role: string; content: readonly Part[] };

export function toFlat(messages: readonly unknown[]): Flat[] {
  const flat: Flat[] = [];
  for (const message of messages as Message[]) {
    if (message.role === "user") {
      flat.push({ role: "user", text: message.content.filter((p) => p.type === "text").map((p) => p.text).join("") });
    } else if (message.role === "assistant") {
      let text = "";
      let calls: { id: string; name: string; args: unknown }[] = [];
      let results: Flat[] = [];
      const flush = () => {
        if (text || calls.length) flat.push({ role: "assistant", text, tool_calls: calls });
        flat.push(...results);
        text = "";
        calls = [];
        results = [];
      };
      for (const part of message.content) {
        if (part.type === "text") {
          if (calls.length) flush();
          text += part.text ?? "";
        } else if (part.type === "tool-call") {
          calls.push({ id: part.toolCallId as string, name: part.toolName as string, args: part.args });
          if (part.result !== undefined) {
            const content = typeof part.result === "string" ? part.result : JSON.stringify(part.result);
            results.push({ role: "tool", tool_call_id: part.toolCallId as string, content });
          }
        }
      }
      flush();
    }
  }
  return flat;
}

const plain = (text: string) => ({ content: [{ type: "text" as const, text }] });

export function makeAdapter(block: BlockSpec): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      let response: Response;
      try {
        response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ block, messages: toFlat(messages) }),
          signal: abortSignal,
        });
      } catch (error) {
        if (abortSignal.aborted) throw error;
        yield plain(BUSY);
        return;
      }
      if (!response.ok || !response.body) {
        yield plain(BUSY);
        return;
      }
      const parts: ThreadAssistantMessagePart[] = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const event = JSON.parse(chunk.replace(/^data: /, ""));
          const last = parts[parts.length - 1];
          if (event.type === "text") {
            if (last?.type === "text") parts[parts.length - 1] = { type: "text", text: last.text + event.delta };
            else parts.push({ type: "text", text: event.delta });
          } else if (event.type === "tool_call") {
            parts.push({ type: "tool-call", toolCallId: event.id, toolName: event.name, args: event.args, argsText: JSON.stringify(event.args) });
          } else if (event.type === "tool_result") {
            const index = parts.findIndex((p) => p.type === "tool-call" && p.toolCallId === event.id);
            const call = parts[index];
            if (call?.type === "tool-call") parts[index] = { ...call, result: JSON.parse(event.result) };
          } else if (event.type === "error") {
            parts.push({ type: "text", text: event.message });
          }
          yield { content: [...parts] };
        }
      }
    },
  };
}
