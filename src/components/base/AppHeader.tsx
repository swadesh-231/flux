import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Plus, Zap } from "lucide-react";

import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { Button } from "@/components/ui/button";
import { APP_NAV_LINKS, isPlanKey, PLANS, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

import AppNav from "./AppNav";
import HeaderShell from "./HeaderShell";
import Logo from "./Logo";
import MobileNav from "./MobileNav";

/** Tightens up in step with the shell as it condenses. */
const squeeze =
  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

/**
 * Remaining generations, and the plan they came from. A link rather than a
 * label — running low is the moment someone wants the billing page, so make
 * the number the way there.
 */
function CreditsPill({ credits, plan }: { credits: number; plan: string }) {
  const label = PLANS[isPlanKey(plan) ? plan : "free"].label;
  const low = credits <= 2;

  return (
    <Link
      href="/billing"
      title={`${credits} generations left on the ${label} plan`}
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 md:inline-flex",
        "font-mono text-[0.625rem] uppercase tracking-[0.14em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        low
          ? "border-destructive/40 bg-destructive/[0.08] text-destructive hover:bg-destructive/[0.14]"
          : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-brand/30 hover:text-brand-soft",
      )}
    >
      <Zap className="size-3" aria-hidden />
      <span className="tabular-nums">{credits}</span>
      <span aria-hidden className="text-muted-foreground/40">
        /
      </span>
      {label}
    </Link>
  );
}

/**
 * Chrome for the signed-in app — a different bar from the marketing one, in the
 * same shell.
 *
 * The nav sits immediately after the wordmark, on the left: an app bar reads
 * left-to-right as brand → where you are → what you can do, and a centred
 * "Projects" would read as a marketing anchor. The centre track is left empty
 * on purpose, which is also what makes the two headers tell themselves apart at
 * a glance.
 *
 * Geometry is inherited from `HeaderShell` unchanged — the workspace sizes
 * itself with `h-[calc(100dvh-5.5rem)]` against exactly this height.
 */
export function AppHeader({
  credits,
  plan,
}: {
  credits: number;
  plan: string;
}) {
  return (
    <HeaderShell>
      <div className="flex w-full items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link
          href="/projects"
          aria-label={`${SITE.name} — projects`}
          className="shrink-0 text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Logo
            className={cn(
              "origin-left",
              squeeze,
              "group-data-[state=condensed]/header:scale-[0.94]",
            )}
            wordmarkClassName="hidden sm:block"
          />
        </Link>

        {/* Hairline between brand and nav, so the two left clusters don't read
            as one run-on group. */}
        <span
          aria-hidden
          className="hidden h-5 w-px shrink-0 bg-border sm:block"
        />

        <AppNav />

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <CreditsPill credits={credits} plan={plan} />

          <NewProjectDialog>
            <Button size="sm" className="hidden rounded-full sm:inline-flex">
              New project
              <Plus data-icon="inline-end" aria-hidden />
            </Button>
          </NewProjectDialog>

          {/* Same action, icon-only, where the label will not fit. */}
          <NewProjectDialog>
            <Button
              size="icon-sm"
              className="rounded-full sm:hidden"
              aria-label="New project"
            >
              <Plus aria-hidden />
            </Button>
          </NewProjectDialog>

          <span
            aria-hidden
            className="hidden h-5 w-px shrink-0 bg-border sm:block"
          />

          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />

          {/* Below `sm` the inline nav is hidden, so it moves in here. */}
          <MobileNav
            links={APP_NAV_LINKS}
            withAuthActions={false}
            triggerClassName="sm:hidden"
          />
        </div>
      </div>
    </HeaderShell>
  );
}

export default AppHeader;
