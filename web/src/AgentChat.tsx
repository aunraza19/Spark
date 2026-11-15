import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchHabitats, type AgentAnswer, type BlockSpec, type Habitat } from "./api";
import { describeBlock } from "./chatContext";
import { ChatPanel } from "./ChatPanel";
import { PRESSURE_VIEWS } from "./scale";

export type ChatRequest = { block: BlockSpec; answer?: AgentAnswer; opener?: HTMLElement | null };

export type AgentChat = {
  chat: ChatRequest | null;
  view: BlockSpec | null;
  openChat: (request: ChatRequest) => void;
  closeChat: () => void;
  setView: (block: BlockSpec | null) => void;
};

const idle: AgentChat = { chat: null, view: null, openChat() {}, closeChat() {}, setView() {} };

const AgentChatContext = createContext<AgentChat>(idle);

export const useAgentChat = () => useContext(AgentChatContext);

/** One chat panel for the whole page. The header, "Ask more" and the pages all go through it. */
export function AgentChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState<ChatRequest | null>(null);
  const [view, setView] = useState<BlockSpec | null>(null);
  const [habitats, setHabitats] = useState<Habitat[]>([]);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetchHabitats()
      .then(setHabitats)
      .catch(() => {});
  }, []);

  const openChat = useCallback((request: ChatRequest) => {
    opener.current = request.opener ?? null;
    setChat(request);
  }, []);

  const closeChat = useCallback(() => {
    const back = opener.current;
    opener.current = null;
    setChat(null);
    back?.focus();
  }, []);

  const value = useMemo(() => ({ chat, view, openChat, closeChat, setView }), [chat, view, openChat, closeChat]);

  return (
    <AgentChatContext.Provider value={value}>
      {children}
      {chat && (
        <ChatPanel
          key={JSON.stringify([chat.block, Boolean(chat.answer)])}
          block={chat.block}
          label={describeBlock(chat.block, habitats)}
          answer={chat.answer}
          onClose={closeChat}
        />
      )}
    </AgentChatContext.Provider>
  );
}

const DEFAULT_VIEW: BlockSpec = { kind: "map", habitat: "lunar", shown_psi_max: PRESSURE_VIEWS.zoomed[1] };

/** The Spark agent button that is on every page. It opens the chat about the view the reader is looking at. */
export function SiteHeader() {
  const { chat, view, openChat, closeChat } = useAgentChat();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <header className="site-header">
      <button
        type="button"
        className="button"
        ref={button}
        aria-expanded={chat !== null}
        onClick={() => (chat ? closeChat() : openChat({ block: view ?? DEFAULT_VIEW, opener: button.current }))}
      >
        Spark agent
      </button>
    </header>
  );
}

/** A page tells the header what it is showing, so the chat can be about it. */
export function useRegisterView(block: BlockSpec) {
  const { setView } = useAgentChat();
  const key = JSON.stringify(block);
  useEffect(() => {
    setView(JSON.parse(key));
    return () => setView(null);
  }, [key, setView]);
}
