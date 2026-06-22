import { createFileRoute } from "@tanstack/react-router";
import { PrivacyBanner } from "@/components/PrivacyBanner";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Clean Start" },
      { name: "description", content: "Have a guided conversation about clean energy options for your home." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <>
      <PrivacyBanner />
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Chat coming soon</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The conversational interface will live here. Scaffolded in Prompt 3.
        </p>
      </div>
    </>
  );
}
