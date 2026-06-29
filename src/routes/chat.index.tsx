import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { PrivacyBanner } from "@/components/PrivacyBanner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Leaf, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Chat — Clean Start" },
      {
        name: "description",
        content:
          "Ask anything about solar, heat pumps, EVs, or home efficiency. Plain-language answers, no pressure.",
      },
    ],
  }),
  component: ChatPage,
});

const STORAGE_KEY = "cleanstart.chat.v1";

const STARTERS = [
  { category: "Solar", prompt: "Is solar worth it for a renter?" },
  { category: "Heat pumps", prompt: "How does a heat pump compare to gas?" },
  { category: "EVs", prompt: "What EV tax credits are available?" },
  { category: "Efficiency", prompt: "Easiest efficiency upgrade for my home?" },
] as const;

function ChatPage() {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      setInitialMessages([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as UIMessage[]) : [];
      setInitialMessages(Array.isArray(parsed) ? parsed : []);
    } catch {
      setInitialMessages([]);
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/public/chat-guest",
        body: () => ({ persona: null }),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    id: "cleanstart-chat",
    messages: initialMessages ?? [],
    transport,
    onError(err) {
      toast.error(err.message || "Something went wrong");
    },
  });

  useEffect(() => {
    if (typeof window === "undefined" || initialMessages === null) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, initialMessages]);

  useEffect(() => {
    if (status === "ready") inputRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (initialMessages !== null) inputRef.current?.focus();
  }, [initialMessages]);

  const isBusy = status === "submitted" || status === "streaming";

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      <PrivacyBanner />
      <div className="mx-auto flex h-[calc(100vh-12rem)] min-h-[500px] max-w-3xl flex-col px-4 pb-4 pt-4">
        {/* Thread area */}
        <Conversation className="flex-1">
          <ConversationContent className="px-0">
            {!hasMessages ? (
              <StarterState onPick={handleSend} disabled={isBusy} />
            ) : (
              <div className="flex flex-col gap-6">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  const text = m.parts
                    .map((p) => (p.type === "text" ? p.text : ""))
                    .join("");
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col gap-1",
                        isUser ? "items-end" : "items-start",
                      )}
                    >
                      <span className="px-1 text-xs text-muted-foreground">
                        {isUser ? "You" : "Clean Start"}
                      </span>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                          isUser
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-card text-foreground",
                        )}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{text}</p>
                        ) : (
                          <MessageResponse>{text}</MessageResponse>
                        )}
                      </div>
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex flex-col gap-1 items-start">
                    <span className="px-1 text-xs text-muted-foreground">
                      Clean Start
                    </span>
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input bar */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask anything about clean energy…"
              className="w-full resize-none rounded-full border border-border bg-card py-3 pl-5 pr-14 text-sm shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isBusy}
              aria-label="Send message"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-dark disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            No account required · your conversations stay private
          </p>
        </div>
      </div>
    </>
  );
}

function StarterState({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
        <Leaf className="h-6 w-6 text-primary-dark" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        What are you curious about?
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Ask anything about solar, heat pumps, EVs, or home efficiency. No jargon,
        no pressure.
      </p>

      <div className="mt-8 grid w-full max-w-[500px] grid-cols-1 gap-3 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.category}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s.prompt)}
            className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-60"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary-dark">
              {s.category}
            </span>
            <span className="text-sm text-muted-foreground transition group-hover:text-foreground">
              {s.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1" aria-label="Assistant is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  );
}
