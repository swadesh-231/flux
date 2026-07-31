"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, MessageSquare, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/types/project";

import { DeleteProjectModal } from "./DeleteProjectModal";

/**
 * One project in the gallery.
 *
 * The whole card is the link — a stretched overlay rather than a wrapping
 * anchor, so the delete control can sit inside the same box without nesting an
 * interactive element in a link. Everything above the overlay that should stay
 * clickable is lifted with `z-10`.
 *
 * Colours resolve through theme tokens. An earlier version hard-coded
 * `#0f0f0f` and `white/6`, which meant the card ignored `globals.css` entirely
 * and stayed black-on-black wherever the surrounding surface changed.
 */
export function ProjectCard({ project }: { project: ProjectSummary }) {
  const title = project.title ?? "Untitled project";
  const timeAgo = formatDistanceToNow(new Date(project.updatedAt), {
    addSuffix: true,
  });

  // The transcript stores a user turn and an assistant turn per exchange.
  const exchanges = Math.floor(project.messageCount / 2);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card/40 p-5",
        "transition-colors duration-300 hover:border-brand/25 hover:bg-card/70",
        "focus-within:border-brand/40",
      )}
    >
      <Link
        href={`/workspace?id=${project.id}`}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={`Open ${title}`}
      />

      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug tracking-tight text-foreground">
          {title}
        </h3>

        <div className="flex shrink-0 items-center gap-1">
          {/* Affordance only — the stretched link underneath does the work. */}
          <ArrowUpRight
            aria-hidden
            className="size-3.5 text-muted-foreground/30 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
          />

          <DeleteProjectModal project={project}>
            <span
              aria-label={`Delete ${title}`}
              className="relative z-10 flex size-6 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </span>
          </DeleteProjectModal>
        </div>
      </div>

      {/* Reserves its two lines whether or not there is a prompt, so the meta
          rule lands on the same baseline across the row. */}
      <p className="mt-2 line-clamp-2 min-h-[2.25rem] text-pretty text-xs leading-relaxed text-muted-foreground/70">
        {project.firstPrompt ?? "No prompt yet — opened but never generated."}
      </p>

      <div className="mt-auto flex items-center gap-3 border-t border-border pt-3.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <MessageSquare className="size-3" aria-hidden />
          {exchanges} {exchanges === 1 ? "turn" : "turns"}
        </span>

        <span aria-hidden className="text-muted-foreground/25">
          /
        </span>

        <span className="truncate normal-case tracking-normal">{timeAgo}</span>
      </div>
    </article>
  );
}

export default ProjectCard;
