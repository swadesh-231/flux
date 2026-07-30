"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { checkUser } from "@/lib/checkUser";
import { db } from "@/lib/prisma";
import type { WorkspaceUser, WorkspaceData } from "@/types/workspace";

// ─── Get the current authenticated user ──────────────────────────────────────

export async function getWorkspaceUser(): Promise<WorkspaceUser> {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/");

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, credits: true, plan: true },
  });

  if (user) return user;

  // No row yet. On a first visit this page renders in parallel with the layout
  // that provisions it, so the read above can lose that race — `checkUser` is
  // request-cached, so this joins the in-flight call rather than racing it.
  const provisioned = await checkUser();
  if (!provisioned) redirect("/");

  return {
    id: provisioned.id,
    credits: provisioned.credits,
    plan: provisioned.plan,
  };
}

// ─── Get a workspace by id (must belong to the current user) ─────────────────

export async function getWorkspaceById(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceData> {
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: {
      id: true,
      title: true,
      messages: true,
      fileData: true,
    },
  });

  // Missing or someone else's — indistinguishable to the caller by design.
  if (!workspace) redirect("/projects");

  return workspace;
}
