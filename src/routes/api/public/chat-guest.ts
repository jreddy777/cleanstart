import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildSystemPrompt, type Persona } from "@/lib/clean-start-prompt";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type Body = {
  persona?: Persona;
  messages?: UIMessage[];
};

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
        const system = buildSystemPrompt({
          persona: body.persona ?? null,
          assistantTurnCount,
        });

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
