import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your Sessions — Clean Start" },
      { name: "description", content: "Review your past clean energy research sessions." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Your Research Sessions</h1>
      <p className="mt-2 text-sm text-muted-foreground">Built in Prompt 5.</p>
    </div>
  ),
});
