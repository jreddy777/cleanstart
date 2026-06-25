import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthModal } from "@/components/AuthModal";
import { PrivacyBanner } from "@/components/PrivacyBanner";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Loader2, Leaf, Home, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Your conversations — Clean Start" },
      { name: "description", content: "Start a new clean energy conversation or pick up where you left off." },
    ],
  }),
  component: ChatIndex,
});

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

const personas = [
  { id: "homeowner", label: "I'm a homeowner", icon: Home, hint: "Solar, heat pumps, retrofits, EV charging" },
  { id: "renter", label: "I'm a renter", icon: Building2, hint: "What you can change today, even without owning" },
  { id: "curious", label: "Just curious", icon: Sparkles, hint: "Start with the big picture and concepts" },
] as const;

function ChatIndex() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from("sessions")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load your conversations");
        else setSessions(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const startConversation = async (persona: "homeowner" | "renter" | "curious") => {
    if (!user) {
      // Guest mode — no DB, messages stored in this browser only.
      navigate({ to: "/chat/guest", search: { persona } });
      return;
    }
    setCreating(persona);
    try {
      // Persist persona preference
      await supabase.from("profiles").update({ persona }).eq("id", user.id);

      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, title: "New conversation" })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("Failed to create session");
      navigate({ to: "/chat/$sessionId", params: { sessionId: data.id }, search: { persona } });
    } catch (e) {
      toast.error("Couldn't start a new conversation");
      console.error(e);
    } finally {
      setCreating(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <PrivacyBanner />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="mb-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light">
            <Leaf className="h-6 w-6 text-primary-dark" />
          </span>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Where would you like to start?
          </h1>
          <p className="mt-3 text-muted-foreground">
            Pick what fits best — you can always change direction later.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {personas.map(({ id, label, icon: Icon, hint }) => (
            <button
              key={id}
              onClick={() => startConversation(id)}
              disabled={creating !== null}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:shadow-sm disabled:opacity-60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                {creating === id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <div>
                <div className="font-medium">{label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
              </div>
            </button>
          ))}
        </div>

        {user && (
          <section className="mt-14">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your conversations</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/history">View all</Link>
              </Button>
            </div>
            {loading ? (
              <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">Loading…</div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                You haven't started a conversation yet. Pick a starting point above.
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {sessions.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/chat/$sessionId"
                      params={{ sessionId: s.id }}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-secondary/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.title || "New conversation"}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
                        </div>
                      </div>
                      <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!user && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            You'll be asked to sign in so we can save your conversation and report.
          </p>
        )}
      </div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="signup" />
    </>
  );
}
