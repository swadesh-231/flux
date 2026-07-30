"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import type { ProjectSummary } from "@/types/project";

/** Longest slice of the opening prompt shown on a project card. */
const PREVIEW_LENGTH = 120;

function isUserMessage(
  value: unknown,
): value is { role: string; content: string } {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return message.role === "user" && typeof message.content === "string";
}

/** The signed-in user's local row id, or a redirect if there isn't one. */
async function requireUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (user) return user.id;

  // No row yet. On a first visit this page renders in parallel with the layout
  // that provisions it, so the read above can lose that race — `checkUser` is
  // request-cached, so this joins the in-flight call rather than racing it.
  const provisioned = await checkUser();
  if (!provisioned) redirect("/");

  return provisioned.id;
}

// ─── Get all workspaces for the current user ──────────────────────────────────

export async function getUserProjects(): Promise<ProjectSummary[]> {
  const userId = await requireUserId();

  const workspaces = await db.workspace.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return workspaces.map((workspace) => {
    const messages = Array.isArray(workspace.messages) ? workspace.messages : [];
    const firstUserMessage = messages.find(isUserMessage);

    return {
      id: workspace.id,
      title: workspace.title,
      firstPrompt: firstUserMessage?.content.slice(0, PREVIEW_LENGTH) ?? null,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      messageCount: messages.length,
    };
  });
}

// ─── Delete a workspace ───────────────────────────────────────────────────────

export async function deleteProject(workspaceId: string): Promise<void> {
  const userId = await requireUserId();

  // Scoped by userId, so this is a no-op on someone else's workspace rather
  // than a 500 — the caller learns nothing about whether the id exists.
  await db.workspace.deleteMany({ where: { id: workspaceId, userId } });

  revalidatePath("/projects");
}
