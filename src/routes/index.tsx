import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Leaf, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clean Start — Your Clean Energy Education Companion" },
      { name: "description", content: "Understand solar, heat pumps, EVs, and efficiency upgrades at your own pace. No jargon, no pressure, no vendor pitches." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
        <Leaf className="h-7 w-7 text-primary-dark" />
      </span>
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        Clean energy starts with understanding, not overwhelm.
      </h1>
      <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
        Clean Start guides you through the basics — solar, heat pumps, efficiency upgrades, and more —
        at your own pace, with no pressure and no jargon.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/chat">
            Start exploring <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link to="/about">See how it works</Link>
        </Button>
      </div>
      <p className="mt-10 text-xs text-muted-foreground">
        🔒 No account required to start. No personal data sold. Ever.
      </p>
    </section>
  );
}
