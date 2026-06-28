import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Leaf, Zap, Sun, Car, Home } from "lucide-react";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources · Clean Start" },
      {
        name: "description",
        content:
          "Independent, non-commercial resources for clean energy incentives, solar, EVs, and renter-friendly electrification.",
      },
      { property: "og:title", content: "Resources · Clean Start" },
      {
        property: "og:description",
        content:
          "Trusted, vendor-neutral places to go deeper on clean energy decisions.",
      },
    ],
  }),
  component: ResourcesPage,
});

type Resource = {
  title: string;
  description: string;
  label: string;
  href: string;
};

const incentives: Resource[] = [
  {
    title: "DSIRE",
    description:
      "The national database of state and federal clean energy incentives and rebates.",
    label: "Incentives",
    href: "https://www.dsireusa.org",
  },
  {
    title: "EnergySage",
    description:
      "Compare solar quotes and understand financing options with unbiased marketplace data.",
    label: "Solar",
    href: "https://www.energysage.com",
  },
  {
    title: "IRS Clean Energy Credits",
    description:
      "Official IRS guidance on federal EV and home energy tax credits.",
    label: "Tax Credits",
    href: "https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after",
  },
  {
    title: "Energy.gov Rebates",
    description:
      "DOE overview of current home efficiency tax credit programs.",
    label: "Efficiency",
    href: "https://www.energy.gov/energysaver/federal-tax-credits-energy-efficiency",
  },
];

const solar: Resource[] = [
  {
    title: "EnergyStar",
    description:
      "EPA's program for energy-efficient appliances, windows, HVAC, and building materials.",
    label: "Efficiency",
    href: "https://www.energystar.gov",
  },
  {
    title: "NREL",
    description:
      "The National Renewable Energy Laboratory — research, data, and tools on solar, wind, and storage.",
    label: "Research",
    href: "https://www.nrel.gov",
  },
  {
    title: "PVWatts Calculator",
    description:
      "NREL's free tool to estimate solar output for any U.S. address.",
    label: "Solar",
    href: "https://pvwatts.nrel.gov",
  },
];

const evs: Resource[] = [
  {
    title: "PlugShare",
    description:
      "Community-sourced EV charging station map across North America.",
    label: "EVs",
    href: "https://www.plugshare.com",
  },
  {
    title: "Alternative Fuels Station Locator",
    description:
      "DOE tool to find EV, CNG, hydrogen, and other alt-fuel stations near you.",
    label: "EVs",
    href: "https://afdc.energy.gov/stations",
  },
  {
    title: "Consumer Reports EV Guide",
    description:
      "Independent EV reviews and owner reliability data.",
    label: "EVs",
    href: "https://www.consumerreports.org/cars/electric-cars",
  },
];

const renters: Resource[] = [
  {
    title: "Green Renter",
    description:
      "DOE guidance specifically for renters on reducing energy costs and accessing incentives.",
    label: "Renters",
    href: "https://www.energy.gov/energysaver/renters",
  },
  {
    title: "Rewiring America",
    description:
      "Nonprofit focused on household electrification — calculators, policy explainers, and planning tools.",
    label: "Electrification",
    href: "https://www.rewiringamerica.org",
  },
];

function ResourcesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Leaf className="h-3.5 w-3.5 text-primary" />
          Helpful links
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Trusted places to go deeper.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Every source below is independent, non-commercial, and publicly
          available. We've organized them by topic so you can pick up wherever
          your Clean Start conversation left off.
        </p>
      </header>

      <Section
        icon={<Zap className="h-3.5 w-3.5" />}
        eyebrow="Section 1"
        title="Incentives & Rebates"
        items={incentives}
      />
      <Section
        icon={<Sun className="h-3.5 w-3.5" />}
        eyebrow="Section 2"
        title="Solar & Home Energy"
        items={solar}
      />
      <Section
        icon={<Car className="h-3.5 w-3.5" />}
        eyebrow="Section 3"
        title="Electric Vehicles"
        items={evs}
      />
      <Section
        icon={<Home className="h-3.5 w-3.5" />}
        eyebrow="Section 4"
        title="Renters & Multifamily"
        items={renters}
      />

      <section className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-5 text-xs text-muted-foreground">
        <p>
          Clean Start does not maintain, vet, or have any commercial
          relationship with the sites listed above. Links are provided for
          informational purposes — confirm details directly with the program or
          provider.
        </p>
      </section>
    </div>
  );
}

function Section({
  icon,
  eyebrow,
  title,
  items,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  items: Resource[];
}) {
  return (
    <section className="mb-12">
      <div className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
        {icon}
        {eyebrow}
      </div>
      <h2 className="mb-5 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((r) => (
          <ResourceCard key={r.href} resource={r} />
        ))}
      </div>
    </section>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {resource.label}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <h3 className="font-medium text-foreground">{resource.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>
    </a>
  );
}
