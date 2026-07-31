"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/actions/project";
import type { ProjectSummary } from "@/types/project";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DeleteProjectModalProps {
  project: ProjectSummary;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeleteProjectModal({
  project,
  children,
}: DeleteProjectModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProject(project.id);
        toast.success("Project deleted.");
        router.refresh();
      } catch {
        toast.error("Failed to delete project. Please try again.");
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>

      {/* Themed through tokens rather than literal hexes, so the dialog follows
          `globals.css` like every other surface. */}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-normal tracking-tight">
            Delete project?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            &ldquo;{project.title ?? "Untitled project"}&rdquo; will be
            permanently deleted, along with its transcript and generated files.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="rounded-full">
              Cancel
            </Button>
          </DialogClose>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-full"
          >
            {isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}