import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildSystemPrompt, type Persona } from "@/lib/clean-start-prompt";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type Tenure = "homeowner" | "renter" | "curious" | null;
type Location = { zip: string; city: string; state: string; utility: string } | null;
type Body = {
  persona?: Persona;
  tenure?: Tenure;
  location?: Location;
  messages?: UIMessage[];
};

const TENURE_LABEL: Record<NonNullable<Tenure>, string> = {
  homeowner: "homeowner",
  renter: "renter",
  curious: "exploring (not sure yet)",
};

function buildContextSystem(tenure: Tenure, location: Location) {
  // Resolve every placeholder up front — never leave a [BRACKET] token in
  // the final prompt, since the model treats unresolved placeholders as
  // unknown context and re-asks the user.
  const tenureValue = tenure ? TENURE_LABEL[tenure] : "not provided";
  const cityState = location ? `${location.city}, ${location.state}` : "not provided";
  const utility = location?.utility ? location.utility : "not provided";

  return `USER SESSION CONTEXT (collected during onboarding, before this chat began):
- Tenure: ${tenureValue}
- Location: ${cityState}
- Utility: ${utility}

IMPORTANT: The user has already provided their tenure and location during onboarding. Do NOT ask for ownership status, location, state, city, zip code, or utility again. Use the context above to personalize responses directly. Only ask follow-up questions about topics not already covered by the session context.

Personalization rules:
- Homeowner: focus on installations, tax credits, utility rebates.
- Renter: focus on community solar, portable upgrades, renter-eligible rebates, EV credits.
- Exploring: give accessible overviews of all options.
- When location is known, reference the city, state, and utility by name and surface state-specific programs relevant to that service territory.`;
}

// Very small in-memory rate limiter, per worker instance. Best-effort only.
const RATE_LIMIT = 30; // requests
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}

export const Route = createFileRoute("/api/public/chat-guest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "anon";
        if (rateLimited(ip)) {
          return new Response("Too many requests", { status: 429 });
        }

        const body = (await request.json()) as Body;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return new Response("Bad request", { status: 400 });
        }

        // Cap guest conversation length to keep cost bounded
        const trimmed = messages.slice(-20);

        const assistantTurnCount = trimmed.filter((m) => m.role === "assistant").length;
        const tenure = body.tenure ?? null;
        const location = body.location ?? null;
        const personaFromTenure: Persona =
          tenure === "homeowner" || tenure === "renter" || tenure === "curious" ? tenure : null;

        // Verify onboarding context survives to prompt construction. If these
        // log as null the placeholders fall back to "not provided" and the
        // model will re-ask — which is the bug we just fixed.
        console.log("Session context:", {
          tenure,
          city: location?.city ?? null,
          state: location?.state ?? null,
          utility: location?.utility ?? null,
        });

        // When onboarding context exists, skip the base prompt's DISCOVERY
        // stage (which instructs the model to ask getting-to-know-you
        // questions) by pushing the turn counter past it.
        const contextKnownBoost = (tenure ? 1 : 0) + (location ? 1 : 0);
        const baseSystem = buildSystemPrompt({
          persona: body.persona ?? personaFromTenure,
          assistantTurnCount: assistantTurnCount + contextKnownBoost,
        });
        const system = `${buildContextSystem(tenure, location)}\n\n${baseSystem}`;

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(trimmed),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: trimmed,
          onError: (error) => {
            console.error("[/api/public/chat-guest] stream error", error);
            return error instanceof Error ? error.message : "Stream error";
          },
        });
      },
    },
  },
});
