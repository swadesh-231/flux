"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SUGGESTIONS } from "@/lib/data";

/** Matches the `title` column, which the workspace slices to 80 anyway. */
const MAX_NAME = 80;

/**
 * Names a project before opening the workspace.
 *
 * Both fields are optional: the name falls back to whatever the model titles
 * the app, and an empty brief just drops you into an idle workspace with the
 * composer focused. They travel as search params, because no row exists yet —
 * a workspace is only written on the first successful generation.
 */
export function NewProjectDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [brief, setBrief] = React.useState("");

  const start = () => {
    const params = new URLSearchParams();
    if (name.trim()) params.set("title", name.trim().slice(0, MAX_NAME));
    if (brief.trim()) params.set("prompt", brief.trim());

    setOpen(false);
    router.push(`/workspace${params.size ? `?${params}` : ""}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Return submits from either field; Shift+Return keeps the brief multi-line.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      start();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setName("");
          setBrief("");
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-normal tracking-tight">
            New project
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Give it a name. You can describe it now or once you&apos;re inside.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <label
              htmlFor="project-name"
              className="block font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              Name
            </label>
            <input
              id="project-name"
              autoFocus
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Invoice tracker"
              className="h-10 w-full rounded-lg border border-border bg-card/60 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 focus:border-brand/40 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="project-brief"
              className="flex items-baseline justify-between font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              What should it do?
              <span className="text-muted-foreground/50">Optional</span>
            </label>
            <textarea
              id="project-brief"
              value={brief}
              rows={3}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="A dashboard that tracks unpaid invoices and flags anything overdue."
              className="w-full resize-none rounded-lg border border-border bg-card/60 px-3 py-2.5 text-sm leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground/60 focus:border-brand/40 focus:outline-none"
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTIONS.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => setBrief(suggestion.prompt)}
                  className="rounded-full border border-border px-2.5 py-1 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-brand/30 hover:text-brand-soft"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={start} className="w-full rounded-full sm:w-auto">
            {brief.trim() ? "Build it" : "Open workspace"}
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
