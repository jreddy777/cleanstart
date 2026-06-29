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
  homeowner: "Homeowner",
  renter: "Renter",
  curious: "Exploring / not sure yet",
};

function buildContextSystem(tenure: Tenure, location: Location) {
  const tenureLabel = tenure ? TENURE_LABEL[tenure] : "Unknown";
  const locationLine = location
    ? `${location.city}, ${location.state} served by ${location.utility}`
    : "Location not provided";
  const knownBits: string[] = [];
  if (tenure) knownBits.push(`their housing situation (${tenureLabel})`);
  if (location) knownBits.push(`their location (${locationLine})`);
  const alreadyKnown = knownBits.length
    ? `\n\nIMPORTANT: You ALREADY KNOW ${knownBits.join(" and ")}. DO NOT ask the user about ${tenure ? "ownership/renting" : ""}${tenure && location ? " or " : ""}${location ? "their zip code or location" : ""} again — that context was collected before the chat started. Use it directly to personalize your first response.`
    : "";

  return `You are Clean Start, a friendly and knowledgeable clean energy guide for households. Your job is to educate — never to sell. Keep answers conversational, plain-language, and under 120 words.

The user has provided the following context:
- Tenure: ${tenureLabel}
- Location: ${locationLine}${alreadyKnown}

Use this context to personalize every response from message one:
- Homeowners: focus on installations, tax credits, and utility rebate programs
- Renters: focus on community solar, portable upgrades, renter-eligible rebates, and EV credits
- Explorers: give accessible overviews of all options
- When location is known: reference the city, state, and utility by name; surface state-specific programs and utility rebates relevant to that service territory`;
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
        const baseSystem = buildSystemPrompt({
          persona: body.persona ?? null,
          assistantTurnCount,
        });
        const system = `${buildContextSystem(body.tenure ?? null, body.location ?? null)}\n\n${baseSystem}`;

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
