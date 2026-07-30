import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { getUserProjects } from "@/actions/project";
import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Accent, Display } from "@/components/reusables";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Projects" };

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-card/60">
        <Zap className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mb-1 text-sm font-medium text-foreground/70">
        No projects yet
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        Name one and describe what you want to build.
      </p>
      <NewProjectDialog>
        <Button size="sm" className="rounded-full">Start building</Button>
      </NewProjectDialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectsPage() {
  // `getUserProjects` redirects anonymous callers on its own, and the proxy
  // already guards /projects — no second auth check needed here.
  const projects = await getUserProjects();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Display className="text-[clamp(2rem,5vw,3rem)]">
            Your <Accent>projects.</Accent>
          </Display>
          <p className="mt-3 text-sm text-muted-foreground">
            All your AI-generated apps in one place.
          </p>
        </div>

        {/* Same naming dialog as the header — going straight to /workspace
            here would skip it and leave the project untitled. */}
        <NewProjectDialog>
          <Button size="sm" className="rounded-full">
            New project
            <Zap data-icon="inline-end" aria-hidden />
          </Button>
        </NewProjectDialog>
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ProjectCard projects={projects} />
      )}
    </div>
  );
}
