import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { getUserProjects } from "@/actions/project";
import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { ProjectGallery } from "@/components/project/ProjectGallery";
import { Accent, Display, Eyebrow } from "@/components/reusables";
import { Button } from "@/components/ui/button";
import { checkUser } from "@/lib/checkUser";
import { DEFAULT_PLAN_KEY, isPlanKey, PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

// ─── Stats strip ──────────────────────────────────────────────────────────────

/**
 * The three numbers worth knowing on arrival, on the same hairline grid the
 * landing page uses for features — `gap-px` over a `bg-border` wrapper, so the
 * dividers are the background showing through rather than borders that double
 * up at the seams.
 */
function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/60">
        {label}
      </p>

      <p className="mt-3 font-heading text-3xl font-normal leading-none tracking-tight text-foreground/90 tabular-nums">
        {value}
      </p>

      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        {hint}
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="size-3 text-muted-foreground/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
          />
        ) : null}
      </p>
    </>
  );

  const className = cn(
    "group bg-background p-6 transition-colors duration-300",
    href && "hover:bg-foreground/[0.025]",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Where signing in lands, and the home of the signed-in app: everything the
 * user has built, in one place, under the app's own header rather than the
 * marketing one.
 *
 * `checkUser` is request-cached and the layout above has already called it, so
 * reading the row again here costs nothing.
 */
export default async function ProjectsPage() {
  // `getUserProjects` redirects anonymous callers on its own, and the layout
  // already ran `auth.protect()` — no third auth check needed here.
  const [projects, user] = await Promise.all([getUserProjects(), checkUser()]);

  const planKey =
    user && isPlanKey(user.plan) ? user.plan : DEFAULT_PLAN_KEY;
  const plan = PLANS[planKey];
  const credits = user?.credits ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Workspace</Eyebrow>

          <Display className="mt-4 text-[clamp(2rem,5vw,3rem)]">
            Your <Accent>projects.</Accent>
          </Display>

          <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            Everything you have built with Flux. Open one to keep working on it,
            or start something new.
          </p>
        </div>

        {/* Same naming dialog as the header — going straight to /workspace
            here would skip it and leave the project untitled. */}
        <NewProjectDialog>
          <Button size="sm" className="rounded-full">
            New project
            <Plus data-icon="inline-end" aria-hidden />
          </Button>
        </NewProjectDialog>
      </header>

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        <Stat
          label="Projects"
          value={String(projects.length)}
          hint={projects.length === 1 ? "app built" : "apps built"}
        />
        <Stat
          label="Generations left"
          value={String(credits)}
          hint={credits === 0 ? "top up to keep going" : "this cycle"}
          href="/billing"
        />
        <Stat
          label="Plan"
          value={plan.label}
          hint={`${plan.generations} per month`}
          href="/billing"
        />
      </div>

      <div className="mt-12">
        <ProjectGallery projects={projects} />
      </div>
    </div>
  );
}
