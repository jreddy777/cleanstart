import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthModal } from "@/components/AuthModal";
import { PrivacyBanner } from "@/components/PrivacyBanner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileText,
  Leaf,
  Loader2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  persona: z.enum(["renter", "homeowner", "curious"]).optional(),
});

export const Route = createFileRoute("/chat/$sessionId")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Conversation — Clean Start" },
      { name: "description", content: "Your guided clean energy conversation." },
    ],
  }),
  component: ChatSessionPage,
});

type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

function rowToUIMessage(row: MessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : row.role === "system" ? "system" : "user",
    parts: [{ type: "text", text: row.content }],
  };
}

function ChatSessionPage() {
  const { sessionId } = Route.useParams();
  const { persona: searchPersona } = Route.useSearch();
  const { user, session: authSession, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [persona, setPersona] = useState<string | null>(searchPersona ?? null);
  const [notFound, setNotFound] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing session + messages
  useEffect(() => {
    if (!user) {
      setInitialMessages(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [sessionRes, msgRes, profileRes] = await Promise.all([
        supabase.from("sessions").select("id, user_id").eq("id", sessionId).maybeSingle(),
        supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("persona").eq("id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (sessionRes.error || !sessionRes.data || sessionRes.data.user_id !== user.id) {
        setNotFound(true);
        return;
      }
      setInitialMessages((msgRes.data ?? []).map(rowToUIMessage));
      if (!persona && profileRes.data?.persona) setPersona(profileRes.data.persona);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          ...(authSession?.access_token
            ? { Authorization: `Bearer ${authSession.access_token}` }
            : {}),
        }),
        body: () => ({ sessionId, persona }),
      }),
    [sessionId, persona, authSession?.access_token],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: sessionId,
    messages: initialMessages ?? [],
    transport,
    onError(err) {
      toast.error(err.message || "Something went wrong");
    },
  });

  // Refocus the composer
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [sessionId, initialMessages !== null]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to continue</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your conversation is saved to your account so you can pick it up later.
        </p>
        <AuthOpener />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Conversation not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          It may have been deleted, or it belongs to a different account.
        </p>
        <Button asChild className="mt-6">
          <Link to="/chat">Start a new one</Link>
        </Button>
      </div>
    );
  }

  if (initialMessages === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isBusy = status === "submitted" || status === "streaming";

  const sendFeedback = async (rating: "up" | "down") => {
    if (feedbackSent) return;
    setFeedbackSent(true);
    const { error } = await supabase.from("feedback").insert({
      session_id: sessionId,
      rating,
    });
    if (error) {
      setFeedbackSent(false);
      toast.error("Couldn't record feedback");
      return;
    }
    toast.success("Thanks for the feedback");
  };

  return (
    <>
      <PrivacyBanner />
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 pb-6 pt-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/chat">
              <ArrowLeft className="mr-1 h-4 w-4" /> All chats
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {messages.filter((m) => m.role === "assistant").length >= 3 && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/report" search={{ sessionId } as never}>
                  <FileText className="mr-1 h-4 w-4" /> Generate report
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Transcript */}
        <Conversation className="flex-1 rounded-2xl border border-border bg-card">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Leaf className="h-6 w-6 text-primary" />}
                title="Let's get started"
                description="Tell me a little about your home or what's on your mind — there are no wrong questions."
              />
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role === "user" ? "user" : "assistant"}>
                  <MessageContent>
                    <MessageResponse>
                      {m.parts
                        .map((p) => (p.type === "text" ? p.text : ""))
                        .join("")}
                    </MessageResponse>
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>Thinking…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Feedback */}
        {messages.filter((m) => m.role === "assistant").length >= 2 && !feedbackSent && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Is this helpful?</span>
            <Button variant="ghost" size="sm" onClick={() => sendFeedback("up")}>
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => sendFeedback("down")}>
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Composer */}
        <div className="mt-3">
          <PromptInput
            onSubmit={(msg) => {
              const text = msg.text?.trim();
              if (!text || isBusy) return;
              sendMessage({ text });
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Ask anything — solar, heat pumps, EVs, efficiency…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={isBusy} />
            </PromptInputFooter>
          </PromptInput>
          {error && (
            <p className="mt-2 text-xs text-destructive">{error.message}</p>
          )}
        </div>
      </div>
    </>
  );
}

function AuthOpener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="mt-6" onClick={() => setOpen(true)}>
        Sign in
      </Button>
      <AuthModal open={open} onOpenChange={setOpen} defaultTab="login" />
    </>
  );
}
