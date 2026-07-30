import type { Metadata } from "next";

import { getWorkspaceUser, getWorkspaceById } from "@/actions/workspace";
import { WorkspaceClient } from "@/components/project/WorkspaceClient";

export const metadata: Metadata = { title: "Workspace" };

interface WorkspacePageProps {
  searchParams: Promise<{ prompt?: string; id?: string; title?: string }>;
}

export default async function WorkspacePage({
  searchParams,
}: WorkspacePageProps) {
  const { prompt, id, title } = await searchParams;

  const user = await getWorkspaceUser();
  const workspace = id ? await getWorkspaceById(id, user.id) : null;

  return (
    <WorkspaceClient
      initialPrompt={prompt ?? null}
      initialTitle={title ?? null}
      workspace={workspace}
      userCredits={user.credits}
      userId={user.id}
      userPlan={user.plan}
    />
  );
}
