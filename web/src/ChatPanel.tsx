import { AssistantRuntimeProvider, AuiConfig, Suggestions, useLocalRuntime, type ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useMemo, type PropsWithChildren } from "react";
import type { AgentAnswer, BlockSpec } from "./api";
import { makeAdapter } from "./chatAdapter";
import { Thread, type ThreadComponents } from "@/components/assistant-ui/elements/thread.aui";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { startersFor } from "./starters";
import { GetExperimentCard, QueryTestsCard } from "./ToolCards";

export const NOT_CHECKED = "Answers in the chat are not checked like the explanation above. Check the evidence.";

function explanationText(answer: AgentAnswer): string {
  return [
    `What you are seeing: ${answer.seeing}`,
    `What it means for fire safety: ${answer.fire_safety}`,
    `What the data cannot tell you: ${answer.cannot_tell}`,
    `Sources: ${answer.sources.join(", ")}`,
  ].join("\n\n");
}

const cards: Record<string, ToolCallMessagePartComponent> = { query_tests: QueryTestsCard, get_experiment: GetExperimentCard };

const ToolCard: ToolCallMessagePartComponent = (props) => {
  const Card = cards[props.toolName];
  return Card ? <Card {...props} /> : null;
};

// The cards are short and are the evidence, so they are always open.
const OpenToolGroup = ({ children }: PropsWithChildren) => <>{children}</>;

export function ChatPanel({ block, label, answer, onClose }: { block: BlockSpec; label: string; answer?: AgentAnswer; onClose: () => void }) {
  const blockKey = JSON.stringify(block);
  const adapter = useMemo(() => makeAdapter(block), [blockKey]);
  const runtime = useLocalRuntime(adapter, {
    initialMessages: answer ? [{ role: "assistant", content: [{ type: "text", text: explanationText(answer) }] }] : undefined,
  });
  const config = useMemo(() => AuiConfig({ suggestions: Suggestions(startersFor(block)) }), [blockKey]);
  const components = useMemo<ThreadComponents>(
    () => ({
      ToolFallback: ToolCard,
      ToolGroup: OpenToolGroup,
      Welcome: () => (
        <p data-testid="chat-welcome" className="mb-6 px-2 text-lg font-bold">
          Hello. Ask me about {label}. I can count tests and read experiment records from the data.
        </p>
      ),
    }),
    [label],
  );

  return (
    <aside
      className="chat-panel bg-background text-foreground border-border fixed inset-y-0 right-0 z-50 flex w-[min(440px,100%)] flex-col border-l text-sm max-[720px]:w-full"
      aria-label="Spark agent chat"
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <header className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
        <h3 className="text-base font-bold">Spark agent chat</h3>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>
      <p className="border-border text-muted-foreground border-b px-4 py-2">Talking about: {label}</p>
      <div className="min-h-0 flex-1">
        <TooltipProvider>
          <AssistantRuntimeProvider runtime={runtime} config={config}>
            <Thread components={components} />
          </AssistantRuntimeProvider>
        </TooltipProvider>
      </div>
      <p className="border-border text-muted-foreground border-t px-4 py-2 text-xs">{NOT_CHECKED}</p>
    </aside>
  );
}
