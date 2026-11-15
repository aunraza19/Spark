import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
} from "@assistant-ui/react";
import { useMemo } from "react";
import type { AgentAnswer, BlockSpec } from "./api";
import { makeAdapter } from "./chatAdapter";
import { AGENT_NOTE } from "./content";
import { MarkdownText } from "./safeMarkdown";
import { startersFor } from "./starters";
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
  const followsAQuestion = useAuiState((state) => state.message.index > 0);
  return (
    <MessagePrimitive.Root className="chat-message chat-agent">
      <p className="chat-who">Spark agent</p>
      <MessagePrimitive.Parts components={{ Text: MarkdownText, tools: toolCards }} />
      <ActionBarPrimitive.Root className="chat-actions" hideWhenRunning>
        <ActionBarPrimitive.Copy className="chat-action">Copy</ActionBarPrimitive.Copy>
        {followsAQuestion && <ActionBarPrimitive.Reload className="chat-action">Regenerate</ActionBarPrimitive.Reload>}
      </ActionBarPrimitive.Root>
      <p className="agent-note">{AGENT_NOTE}</p>
    </MessagePrimitive.Root>
  );
}

function Welcome({ block, label }: { block: BlockSpec; label: string }) {
  return (
    <div className="chat-welcome" data-testid="chat-welcome">
      <p>Hello. Ask me about {label}. I can count tests and read experiment records from the data.</p>
      <div className="chat-starters">
        {startersFor(block).map((question) => (
          <ThreadPrimitive.Suggestion key={question} prompt={question} send className="button">
            {question}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({ block, label, answer, onClose }: { block: BlockSpec; label: string; answer?: AgentAnswer; onClose: () => void }) {
  const blockKey = JSON.stringify(block);
  const adapter = useMemo(() => makeAdapter(block), [blockKey]);
  const runtime = useLocalRuntime(adapter, {
    initialMessages: answer ? [{ role: "assistant", content: [{ type: "text", text: explanationText(answer) }] }] : undefined,
  });

  return (
    <aside className="chat-panel" aria-label="Spark agent chat" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <header className="chat-header">
        <h3>Spark agent chat</h3>
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      </header>
      <p className="chat-context">Talking about: {label}</p>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="chat-viewport">
            <ThreadPrimitive.Empty>
              <Welcome block={block} label={label} />
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </ThreadPrimitive.Viewport>
          <ThreadPrimitive.ScrollToBottom className="button chat-scroll">Scroll to latest</ThreadPrimitive.ScrollToBottom>
          <ComposerPrimitive.Root className="chat-composer">
            <ComposerPrimitive.Input autoFocus placeholder="Ask a follow-up question" rows={2} />
            <ThreadPrimitive.If running={false}>
              <ComposerPrimitive.Send className="button">Send</ComposerPrimitive.Send>
            </ThreadPrimitive.If>
            <ThreadPrimitive.If running>
              <ComposerPrimitive.Cancel className="button">Stop</ComposerPrimitive.Cancel>
            </ThreadPrimitive.If>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </AssistantRuntimeProvider>
      <p className="chat-note">{NOT_CHECKED}</p>
    </aside>
  );
}
