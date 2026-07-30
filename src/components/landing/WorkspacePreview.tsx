import { Zap } from "lucide-react";

import { Section } from "@/components/reusables";
import { cn } from "@/lib/utils";

/**
 * A still of the workspace: chat on the left, live preview on the right.
 *
 * Everything inside is a skeleton rather than a screenshot — it stays sharp at
 * any width, weighs nothing, and cannot go out of date with the real product.
 */

const COLUMNS = [
  { name: "Todo", cards: 3 },
  { name: "In progress", cards: 2 },
  { name: "Done", cards: 1 },
] as const;

function WindowChrome() {
  return (
    <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2.5 rounded-full bg-foreground/10" />
        ))}
      </div>

      <div className="mx-auto flex h-6 items-center rounded-md bg-foreground/[0.04] px-3">
        <span className="font-mono text-[0.625rem] tracking-wide text-muted-foreground/70">
          flux.app/workspace
        </span>
      </div>
    </div>
  );
}

function AgentAvatar() {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-background"
    >
      <Zap className="size-3 fill-current" />
    </span>
  );
}

function ChatPanel() {
  return (
    <div className="hidden w-80 shrink-0 flex-col border-r border-border/70 bg-foreground/[0.015] sm:flex">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/70">
          Chat
        </p>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        <div className="flex justify-end">
          <p className="max-w-[15rem] rounded-2xl rounded-br-sm bg-foreground/10 px-3.5 py-2.5 text-xs leading-relaxed text-foreground/80">
            A kanban board with three columns and drag and drop
          </p>
        </div>

        <div className="flex gap-2.5">
          <AgentAvatar />
          <p className="rounded-2xl rounded-tl-sm bg-foreground/[0.04] px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Three columns, one card component, and{" "}
            <code className="rounded bg-brand/10 px-1 py-0.5 font-mono text-[0.6875rem] text-brand-soft">
              @dnd-kit/core
            </code>{" "}
            for the dragging. Adding the board now…
          </p>
        </div>

        <div className="flex gap-2.5">
          <AgentAvatar />
          <span
            className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-foreground/[0.04] px-3.5 py-3"
            aria-label="Assistant is typing"
          >
            {[0, 0.15, 0.3].map((delay) => (
              <span
                key={delay}
                className="size-1.5 animate-bounce rounded-full bg-foreground/40 motion-reduce:animate-none"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="border-t border-border/70 p-3">
        <div className="rounded-xl bg-foreground/[0.04] px-3 py-2">
          <span className="text-xs text-muted-foreground/60">
            Ask for a change…
          </span>
        </div>
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="flex flex-1 gap-3 overflow-hidden p-5">
      {COLUMNS.map((column) => (
        <div key={column.name} className="flex w-1/3 flex-col gap-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground/70">
              {column.name}
            </span>
            <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground/60">
              {column.cards}
            </span>
          </div>

          {Array.from({ length: column.cards }, (_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/60 bg-foreground/[0.02] p-2.5"
            >
              <div
                className="mb-1.5 h-2 rounded-full bg-foreground/15"
                style={{ width: `${60 + i * 15}%` }}
              />
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/[0.08]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PreviewPanel() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border/70 px-4">
        {(["Preview", "Code"] as const).map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "px-3 py-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em]",
              i === 0
                ? "border-b border-brand text-foreground"
                : "text-muted-foreground/60",
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <KanbanSkeleton />
    </div>
  );
}

export function WorkspacePreview() {
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_40px_120px_-60px_rgb(0_0_0/0.9)] ring-1 ring-foreground/[0.03]">
        <WindowChrome />

        <div className="flex h-[26rem]">
          <ChatPanel />
          <PreviewPanel />
        </div>
      </div>
    </Section>
  );
}

export default WorkspacePreview;
