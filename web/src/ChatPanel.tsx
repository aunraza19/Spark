import { AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useLocalRuntime } from "@assistant-ui/react";
import { useMemo } from "react";
import type { AgentAnswer, BlockSpec } from "./api";
import { makeAdapter } from "./chatAdapter";
import { AGENT_NOTE } from "./content";
import { GetExperimentCard, QueryTestsCard } from "./ToolCards";

export const NOT_CHECKED = "Answers in the chat are not checked like the explanation above. Check the evidence.";

const toolCards = { by_name: { query_tests: QueryTestsCard, get_experiment: GetExperimentCard } };

function explanationText(answer: AgentAnswer): string {
  return [
    `What you are seeing: ${answer.seeing}`,
    `What it means for fire safety: ${answer.fire_safety}`,
    `What the data cannot tell you: ${answer.cannot_tell}`,
    `Sources: ${answer.sources.join(", ")}`,
  ].join("\n\n");
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="chat-message chat-user">
      <p className="chat-who">You</p>
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="chat-message chat-agent">
      <p className="chat-who">Spark agent</p>
      <MessagePrimitive.Parts components={{ tools: toolCards }} />
      <p className="agent-note">{AGENT_NOTE}</p>
    </MessagePrimitive.Root>
  );
}

export function ChatPanel({ block, answer, onClose }: { block: BlockSpec; answer: AgentAnswer; onClose: () => void }) {
  const blockKey = JSON.stringify(block);
  const adapter = useMemo(() => makeAdapter(block), [blockKey]);
  const runtime = useLocalRuntime(adapter, {
    initialMessages: [{ role: "assistant", content: [{ type: "text", text: explanationText(answer) }] }],
  });

  return (
    <aside
      className="chat-panel"
      aria-label="Spark agent chat"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <header className="chat-header">
        <h3>Spark agent chat</h3>
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </header>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="chat-viewport">
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </ThreadPrimitive.Viewport>
          <ComposerPrimitive.Root className="chat-composer">
            <ComposerPrimitive.Input autoFocus placeholder="Ask a follow-up question" rows={2} />
            <ComposerPrimitive.Send className="button">Send</ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
      <p className="chat-note">{NOT_CHECKED}</p>
    </aside>
  );
}
