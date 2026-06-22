import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Your Research Summary — Clean Start" },
      { name: "description", content: "Your personalized clean energy research summary." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Research Summary</h1>
      <p className="mt-2 text-sm text-muted-foreground">Built in Prompt 4.</p>
    </div>
  ),
});
