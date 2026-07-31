"use client";

import * as React from "react";
import { Search, X, Zap } from "lucide-react";

import { NewProjectDialog } from "@/components/project/NewProjectDialog";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/types/project";

/** Below this a filter field is more clutter than help. */
const SEARCH_THRESHOLD = 4;

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-24 text-center">
      <span className="mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-card/60">
        <Zap className="size-4 text-brand" aria-hidden />
      </span>

      <p className="font-heading text-xl font-normal tracking-tight text-foreground/90">
        Nothing here yet
      </p>

      <p className="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
        Name a project and describe what you want to build. The first version
        renders in about a minute.
      </p>

      <NewProjectDialog>
        <Button size="sm" className="mt-7 rounded-full">
          Start building
          <Zap data-icon="inline-end" aria-hidden />
        </Button>
      </NewProjectDialog>
    </div>
  );
}

/**
 * The gallery itself — the one interactive part of the projects scene.
 *
 * Filtering happens on the client over an already-loaded list rather than
 * through the server: the whole set is on the page anyway, and a round trip per
 * keystroke to re-sort a few dozen rows would be slower than the typing.
 */
export function ProjectGallery({ projects }: { projects: ProjectSummary[] }) {
  const [query, setQuery] = React.useState("");

  const trimmed = query.trim().toLowerCase();

  const matches = React.useMemo(() => {
    if (!trimmed) return projects;

    return projects.filter((project) =>
      `${project.title ?? ""} ${project.firstPrompt ?? ""}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [projects, trimmed]);

  if (projects.length === 0) return <EmptyState />;

  return (
    <div>
      {projects.length >= SEARCH_THRESHOLD ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50"
            />

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className={cn(
                "h-10 w-full rounded-full border border-border bg-card/40 pl-9 pr-9 text-sm text-foreground",
                "placeholder:text-muted-foreground/60",
                "transition-colors focus:border-brand/40 focus:outline-none",
                // Safari draws its own clear button on top of ours.
                "[&::-webkit-search-cancel-button]:appearance-none",
              )}
            />

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>

          <p
            aria-live="polite"
            className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/60"
          >
            {trimmed
              ? `${matches.length} of ${projects.length}`
              : `${projects.length} projects`}
          </p>
        </div>
      ) : null}

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing matches{" "}
            <span className="text-foreground">“{query.trim()}”</span>.
          </p>

          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-brand transition-opacity hover:opacity-70"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectGallery;
