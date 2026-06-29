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
import { Home, Building2, HelpCircle, ArrowUp } from "lucide-react";
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
const TENURE_KEY = "cleanstart.tenure.v1";

type Tenure = "homeowner" | "renter" | "curious";

const TENURE_META: Record<Tenure, { label: string; icon: typeof Home }> = {
  homeowner: { label: "Homeowner", icon: Home },
  renter: { label: "Renter", icon: Building2 },
  curious: { label: "Exploring", icon: HelpCircle },
};

const CHIPS: Record<Tenure, { category: string; prompt: string }[]> = {
  homeowner: [
    { category: "Solar", prompt: "Is solar worth it for my home?" },
    { category: "Heat pumps", prompt: "How does a heat pump compare to my gas furnace?" },
    { category: "EVs", prompt: "What EV tax credits can I get as a homeowner?" },
    { category: "Efficiency", prompt: "What efficiency upgrades have the best payback?" },
  ],
  renter: [
    { category: "Community solar", prompt: "How does community solar work for renters?" },
    { category: "Rebates", prompt: "What energy rebates are available to renters?" },
    { category: "EVs", prompt: "What EV tax credits are available to me?" },
    { category: "Efficiency", prompt: "How can I lower my energy bill as a renter?" },
  ],
  curious: [
    { category: "Solar", prompt: "Give me a plain-language overview of solar." },
    { category: "Heat pumps", prompt: "What is a heat pump and should I care?" },
    { category: "EVs", prompt: "What EV tax credits are available in 2025?" },
    { category: "Efficiency", prompt: "What are the easiest ways to cut my energy bill?" },
  ],
};

function ChatPage() {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [tenure, setTenure] = useState<Tenure | null>(null);
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
    try {
      const t = window.localStorage.getItem(TENURE_KEY) as Tenure | null;
      if (t === "homeowner" || t === "renter" || t === "curious") setTenure(t);
    } catch {
      // ignore
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/public/chat-guest",
        body: () => ({ persona: null, tenure }),
      }),
    [tenure],
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

  const pickTenure = (t: Tenure) => {
    setTenure(t);
    try {
      window.localStorage.setItem(TENURE_KEY, t);
    } catch {
      // ignore
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const resetTenure = () => {
    setTenure(null);
    try {
      window.localStorage.removeItem(TENURE_KEY);
    } catch {
      // ignore
    }
  };



  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    // If user sends from earlier steps, default tenure to curious so flow can proceed
    if (!tenure) pickTenure("curious");
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
  const step: 1 | 2 | 3 = hasMessages ? 3 : tenure ? 2 : 1;

  return (
    <>
      <PrivacyBanner />
      <div className="mx-auto flex h-[calc(100vh-12rem)] min-h-[500px] max-w-3xl flex-col px-4 pb-4 pt-4">
        {/* Thread / step area */}
        {step === 3 ? (
          <Conversation className="flex-1">
            <ConversationContent className="px-0">
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
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {step === 1 ? (
              <TenureStep onPick={pickTenure} />
            ) : (
              <ChipsStep tenure={tenure!} onPick={handleSend} onChange={resetTenure} disabled={isBusy} />
            )}
          </div>
        )}

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

function StepDots({ active }: { active: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      <span
        className={cn(
          "h-1.5 rounded-full transition-all",
          active === 1 ? "w-6 bg-primary" : "w-1.5 bg-muted",
        )}
      />
      <span
        className={cn(
          "h-1.5 rounded-full transition-all",
          active === 2 ? "w-6 bg-primary" : "w-1.5 bg-muted",
        )}
      />
    </div>
  );
}

function TenureStep({ onPick }: { onPick: (t: Tenure) => void }) {
  const cards: { id: Tenure; title: string; sub: string; Icon: typeof Home }[] = [
    { id: "homeowner", title: "I own my home", sub: "Solar, heat pumps, efficiency upgrades", Icon: Home },
    { id: "renter", title: "I rent", sub: "Community solar, renter rebates, EVs", Icon: Building2 },
    { id: "curious", title: "Not sure yet", sub: "Just learning — show me everything", Icon: HelpCircle },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-2 py-8 text-center">
      <StepDots active={1} />
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary-light">
        <Home className="h-5 w-5 text-primary-dark" />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Tell us about your home
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        This helps us tailor advice, rebates, and programs to your actual situation.
      </p>

      <div className="mt-8 grid w-full max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map(({ id, title, sub, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="group flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition hover:border-primary hover:bg-primary-light/40"
          >
            <Icon className="h-6 w-6 text-primary-dark" />
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{sub}</span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        No account needed · not stored anywhere
      </p>
    </div>
  );
}

function ChipsStep({
  tenure,
  onPick,
  disabled,
}: {
  tenure: Tenure;
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  const { label, icon: Icon } = TENURE_META[tenure];
  return (
    <div className="flex h-full flex-col items-center justify-center px-2 py-8 text-center">
      <StepDots active={2} />
      <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary-light px-3 py-1 text-xs font-medium text-primary-dark">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        What are you curious about?
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Ask anything — no jargon, no pressure.
      </p>

      <div className="mt-8 grid w-full max-w-[480px] grid-cols-1 gap-3 sm:grid-cols-2">
        {CHIPS[tenure].map((c) => (
          <button
            key={c.category}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.prompt)}
            className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm disabled:opacity-60"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-primary-dark">
              {c.category}
            </span>
            <span className="text-sm text-muted-foreground transition group-hover:text-foreground">
              {c.prompt}
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
