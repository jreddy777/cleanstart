import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Clean Start · Privacy-First Energy Guidance" },
      { name: "description", content: "Clean Start is a privacy-first, vendor-neutral education companion for households exploring clean energy." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 prose-clean">
      <h1 className="text-3xl font-semibold tracking-tight">About Clean Start</h1>
      <p className="mt-4 text-muted-foreground">
        Clean Start helps households navigate clean energy options through guided education
        and personalized research support. We are vendor-neutral and privacy-first.
      </p>
      <h2 className="mt-10 text-xl font-semibold">Privacy Policy</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Detailed policy and data controls will be added in Prompt 5.
      </p>
    </article>
  );
}
