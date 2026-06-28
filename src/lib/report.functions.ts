import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

const SessionInput = z.object({ sessionId: z.string().uuid() });

// Simplified schema (no min/max/int constraints) to stay within Gemini's
// structured-output state machine limits. We validate after parsing.
const ReportSchema = z.object({
  readiness_score: z.number(),

  top_options: z
    .array(
      z.object({
        title: z.string().describe("Short name of the option, e.g. 'Rooftop solar'."),
        why: z.string().describe("Why this is a fit for this user, 1-2 sentences."),
        good_fit_when: z.array(z.string()).describe("3-4 short conditions where this fits."),
        tradeoffs: z.string().describe("Honest tradeoff in 1 sentence."),
      }),
    )
    .min(1)
    .max(4),
  key_insights: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe("Plain-language takeaways from the conversation."),
  next_steps: z
    .array(
      z.object({
        step: z.string().describe("Concrete, low-pressure next action."),
        detail: z.string().describe("One sentence of context."),
      }),
    )
    .min(2)
    .max(5),
  resources: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().describe("Why this resource is useful."),
      }),
    )
    .min(1)
    .max(5)
    .describe("Topic-based resources (no URLs, just plain references like 'EPA Energy Star' or 'DOE EV charging basics')."),
});

export type CleanStartReport = z.infer<typeof ReportSchema>;

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: report } = await supabase
      .from("reports")
      .select("*")
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    return report;
  });

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SessionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { sessionId } = data;

    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessErr || !session || session.user_id !== userId) {
      throw new Error("Session not found");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("persona")
      .eq("id", userId)
      .maybeSingle();
    const persona = profile?.persona ?? null;

    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (msgErr) throw new Error("Failed to load conversation");
    if (!messages || messages.length < 2) {
      throw new Error("Have a short conversation first, then come back to generate a report.");
    }

    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are Clean Start's report writer. Read the conversation between the user and the Clean Start guide and produce a calm, plain-language personalized research summary.

Rules:
- No vendor names, no specific prices, no tax advice.
- Tailor to the user's situation${persona ? ` (they identified as: ${persona})` : ""}.
- Honest about tradeoffs. Never pushy.
- Resources are topic/agency references only — no URLs.
- readiness_score reflects how concretely the user can act today (0 = just exploring, 100 = ready to start a project).`;

    const { object } = await generateObject({
      model,
      system,
      schema: ReportSchema,
      prompt: `CONVERSATION TRANSCRIPT:\n\n${transcript}\n\nWrite the personalized research summary now.`,
    });

    const payload = {
      session_id: sessionId,
      user_id: userId,
      persona,
      readiness_score: object.readiness_score,
      top_options: object.top_options,
      key_insights: object.key_insights,
      next_steps: object.next_steps,
      resources: object.resources,
    };

    // Upsert by session_id (one report per session)
    const { data: existing } = await supabase
      .from("reports")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("reports")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      await supabase.from("sessions").update({ is_complete: true }).eq("id", sessionId);
      return updated;
    }

    const { data: inserted, error } = await supabase
      .from("reports")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("sessions").update({ is_complete: true }).eq("id", sessionId);
    return inserted;
  });
