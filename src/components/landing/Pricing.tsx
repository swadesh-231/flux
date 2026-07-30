import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, Check } from "lucide-react";

import { Section, SectionHeader } from "@/components/reusables";
import { Button } from "@/components/ui/button";
import {
  PLAN_LIST,
  planFeatures,
  planRank,
  resolveActivePlanKey,
  type PlanKey,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type Plan = (typeof PLAN_LIST)[number];

/**
 * Which button a card shows, as a chain of guards rather than nested ternaries —
 * the five states are easier to check off when each gets its own line.
 *
 * `activePlanKey` is `null` for visitors, so a signed-out card always leads to
 * the sign-in modal instead of a checkout the user cannot complete.
 */
function PlanCta({
  plan,
  activePlanKey,
}: {
  plan: Plan;
  activePlanKey: PlanKey | null;
}) {
  const variant = plan.featured ? "default" : "outline";
  const className = "w-full rounded-lg";

  if (activePlanKey === null) {
    return (
      <SignInButton mode="modal">
        <Button variant={variant} className={className}>
          {plan.price === 0 ? "Start free" : "Get started"}
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </SignInButton>
    );
  }

  if (activePlanKey === plan.key) {
    return (
      <Button disabled variant="outline" className={className}>
        Current plan
      </Button>
    );
  }

  // The tier without a Clerk plan id is the floor every account already has.
  if (plan.clerkPlanId === null) {
    return (
      <Button disabled variant="outline" className={className}>
        Included
      </Button>
    );
  }

  const isDowngrade = planRank(plan.key) < planRank(activePlanKey);

  return (
    <Button asChild variant={variant} className={className}>
      <Link href="/billing">
        {isDowngrade ? "Downgrade" : "Upgrade"}
        <ArrowRight data-icon="inline-end" aria-hidden />
      </Link>
    </Button>
  );
}

function PlanCard({
  plan,
  activePlanKey,
}: {
  plan: Plan;
  activePlanKey: PlanKey | null;
}) {
  const isActive = activePlanKey === plan.key;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-7 transition-colors duration-300",
        plan.featured
          ? "border-brand/25 bg-brand/[0.045]"
          : "border-border bg-card/40 hover:border-foreground/15",
      )}
    >
      {/* Gold along the top edge, so the featured card is marked by light
          rather than by a badge shouting at the corner. */}
      {plan.featured ? (
        <span
          aria-hidden
          className="absolute inset-x-7 top-0 h-px bg-linear-to-r from-transparent via-brand/60 to-transparent"
        />
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {plan.label}
        </h3>

        {isActive ? (
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-brand">
            Your plan
          </span>
        ) : plan.featured ? (
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-brand-soft">
            Most popular
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted-foreground">
        {plan.description}
      </p>

      <div className="mt-7 flex items-baseline gap-1.5">
        <span className="font-heading text-[2.5rem] leading-none tracking-tight text-foreground">
          {plan.price === 0 ? "Free" : `$${plan.price}`}
        </span>

        {plan.price > 0 ? (
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            / month
          </span>
        ) : null}
      </div>

      <ul className="mb-8 mt-7 space-y-3 border-t border-border pt-7">
        {planFeatures(plan).map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 size-3 shrink-0 text-brand/70"
              aria-hidden
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <PlanCta plan={plan} activePlanKey={activePlanKey} />
      </div>
    </div>
  );
}

export async function Pricing() {
  // Resolved once on the server, so no plan logic — and no `has` round trip —
  // reaches the client.
  const { isAuthenticated, has } = await auth();
  const activePlanKey = isAuthenticated
    ? resolveActivePlanKey((key) => has({ plan: key }))
    : null;

  return (
    <Section id="pricing">
      <SectionHeader
        eyebrow="Pricing"
        title="Start free, and pay"
        accent="only once it earns it."
        lead="Every plan writes the same code. The larger ones just let you ask more often."
      />

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {PLAN_LIST.filter((plan) => plan.active).map((plan) => (
          <PlanCard key={plan.key} plan={plan} activePlanKey={activePlanKey} />
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground/70">
        Change plan or cancel whenever you like. No card required to start.
      </p>
    </Section>
  );
}

export default Pricing;
