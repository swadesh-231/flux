import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { Agent, createTool } from "@cline/sdk";
import { z } from "zod";

import { aj } from "@/lib/arcjet";
import { GENERATION_COST } from "@/lib/constants";
import {
  AllProvidersUnavailableError,
  isTransientLlmMessage,
} from "@/lib/ai/generate";
import {
  configuredProviders,
  type AiProvider,
} from "@/lib/ai/providers";
import { db } from "@/lib/prisma";
import type { FileData } from "@/types/workspace";

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(type: string, payload: object): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId)
    return Response.json({ message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userId, workspaceId, userRequest, fileData } = body as {
    userId: string;
    workspaceId: string;
    userRequest: string; // what the user wants improved
    fileData: FileData;
  };

  if (!userRequest?.trim()) {
    return Response.json({ message: "Nothing to improve" }, { status: 400 });
  }
  if (!fileData?.files || !Object.keys(fileData.files).length) {
    return Response.json({ message: "No files to improve" }, { status: 400 });
  }

  // ── Arcjet: same bucket and injection check as /api/code-gen ───────────────

  const decision = await aj.protect(request, {
    requested: GENERATION_COST,
    userId: clerkId,
    detectPromptInjectionMessage: userRequest,
  });

  if (decision.isDenied()) {
    const isRateLimit = decision.reason.isRateLimit();
    return Response.json(
      {
        message: isRateLimit
          ? "Too many requests. Please slow down."
          : "That request was blocked.",
      },
      { status: isRateLimit ? 429 : 400 }
    );
  }

  // ── Auth + plan + credit checks ────────────────────────────────────────────

  const user = await db.user.findFirst({
    where: { id: userId, clerkId },
    select: { id: true, credits: true, plan: true },
  });

  if (!user)
    return Response.json({ message: "User not found" }, { status: 404 });

  // Pro-only gate. The client shows the same restriction on the Improve button.
  if (user.plan !== "pro")
    return Response.json({ message: "Upgrade required" }, { status: 403 });

  if (user.credits < GENERATION_COST)
    return Response.json({ message: "Insufficient credits" }, { status: 402 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true },
  });
  if (!workspace)
    return Response.json({ message: "Workspace not found" }, { status: 404 });

  // ── Build the agent ────────────────────────────────────────────────────────

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const enqueue = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      // Accumulate file patches as the agent calls update_file
      const patchedFiles: Record<string, { code: string }> = {
        ...fileData.files,
      };
      let finalSummary = "";

      // Set the moment a tool lands a change. A transient provider failure is
      // only safe to retry on a different model while this is false — once
      // edits have been applied, re-running from scratch would compound them.
      let hasAppliedWork = false;

      // ── Tool 1: update_file ──────────────────────────────────────────────
      // The agent calls this once per file it wants to change.
      // We immediately emit a file_patch SSE event so the client can show
      // progress as each file lands.

      const updateFileTool = createTool({
        name: "update_file",
        description:
          "Update or rewrite a file in the React sandbox. Call once per file you need to change.",
        inputSchema: z.object({
          path: z
            .string()
            .describe("File path exactly as it appears, e.g. /App.js"),
          code: z.string().describe("Complete new contents of the file"),
          reason: z
            .string()
            .describe("One sentence explaining what you changed and why"),
        }),
        async execute({ path, code, reason }) {
          patchedFiles[path] = { code };
          hasAppliedWork = true;
          enqueue(sseEvent("file_patch", { path, code, reason }));
          return `Updated ${path}: ${reason}`;
        },
      });

      // ── Tool 2: done_improving ───────────────────────────────────────────
      // Agent calls this when all files are updated.
      // lifecycle.completesRun: true tells the Cline SDK loop to stop
      // immediately after this tool runs instead of continuing iterations.

      const doneImprovingTool = createTool({
        name: "done_improving",
        description:
          "Call this when you have finished making all improvements.",
        inputSchema: z.object({
          summary: z
            .string()
            .describe(
              "A short friendly summary of all the improvements you made (1-3 sentences)"
            ),
        }),
        lifecycle: { completesRun: true },
        async execute({ summary }) {
          finalSummary = summary;
          return "Done.";
        },
      });

      // ── Serialize current files for context ──────────────────────────────
      // We give the agent all current files as context in the system prompt
      // so it knows exactly what it's working with.

      const fileContext = Object.entries(fileData.files)
        .map(([path, { code }]) => `// ${path}\n${code}`)
        .join("\n\n---\n\n");

      const buildAgent = (provider: AiProvider) =>
        new Agent({
          providerId: provider.clineProviderId,
          modelId: provider.model,
          apiKey: provider.apiKey()!,
          maxIterations: 8,
          systemPrompt: `You are an expert React developer improving a live browser preview app.

The app uses React (functional components), Tailwind CSS for styling, and runs in Sandpack.
You CANNOT use TypeScript, CSS modules, or real npm install — only what's already available.
Available packages: react, react-dom, tailwindcss (CDN), lucide-react, recharts, react-router-dom, framer-motion, date-fns, zod, react-hook-form.

Here are the current files:

${fileContext}

WORKFLOW:
1. Understand what the user wants improved.
2. Identify which files need to change.
3. Call update_file for each file that needs changes (always include the COMPLETE file, not just the diff).
4. Once all files are updated, call done_improving with a short summary.

RULES:
- Always write complete file contents — never partial snippets.
- Keep all existing functionality unless asked to remove it.
- The entry point is always /App.js with a default export.
- All imports must reference files you've updated or packages in the available list above.`,
          tools: [updateFileTool, doneImprovingTool],
          // Auto-approve both tools — no human-in-the-loop needed in this context
          toolPolicies: {
            update_file: { autoApprove: true },
            done_improving: { autoApprove: true },
          },
        });

      // Streams agent reasoning to the chat panel. assistant-text-delta fires
      // as the agent types; tool-started fires reliably on every tool call.
      const subscribeToAgent = (agent: Agent) =>
        agent.subscribe((event) => {
          if (event.type === "assistant-text-delta" && event.text) {
            enqueue(sseEvent("thinking", { text: event.text }));
          }

          if (event.type === "tool-started") {
            const name = event.toolCall?.toolName;
            if (name === "update_file") {
              const path =
                (event.toolCall?.input as { path?: string })?.path ?? "a file";
              enqueue(
                sseEvent("thinking", { text: `\n\nUpdating \`${path}\`…` })
              );
            } else if (name === "done_improving") {
              enqueue(
                sseEvent("thinking", { text: "\n\nFinalizing improvements…" })
              );
            }
          }
        });

      // Set per attempt so the abort listener always targets the live agent.
      let activeAgent: Agent | null = null;
      const abortAgent = () => activeAgent?.abort("client disconnected");
      request.signal.addEventListener("abort", abortAgent);

      try {
        enqueue(sseEvent("status", { message: "Cline agent starting…" }));

        // ── Run the agent, falling back across models ─────────────────────
        // A single Gemini model can sit at 503 for long stretches. Retrying on
        // the next one is only safe before any edit has landed — see
        // `hasAppliedWork`.

        let result: Awaited<ReturnType<Agent["run"]>> | null = null;
        let lastTransientMessage = "";

        for (const provider of configuredProviders()) {
          const agent = buildAgent(provider);
          activeAgent = agent;
          const unsubscribe = subscribeToAgent(agent);

          try {
            const attempt = await agent.run(userRequest);

            if (attempt.status === "failed") {
              const message = attempt.error?.message ?? "Agent run failed";
              if (isTransientLlmMessage(message) && !hasAppliedWork) {
                lastTransientMessage = message;
                console.warn(
                  `[improve] ${provider.id} unavailable: ${message}`
                );
                continue;
              }
              throw new Error(message);
            }

            result = attempt;
            break;
          } finally {
            unsubscribe();
          }
        }

        if (!result) {
          throw new AllProvidersUnavailableError(lastTransientMessage);
        }
        if (result.status === "aborted") {
          // Client-initiated stop — nothing to save, nothing to charge.
          return;
        }

        // ── Charge the credit ─────────────────────────────────────────────
        // Conditional, so concurrent runs can't drive the balance negative.

        const charged = await db.user.updateMany({
          where: { id: userId, credits: { gte: GENERATION_COST } },
          data: { credits: { decrement: GENERATION_COST } },
        });

        if (charged.count === 0) {
          enqueue(
            sseEvent("error", {
              message: "You're out of credits. Upgrade to keep building.",
            })
          );
          return;
        }

        const newFileData: FileData = {
          files: patchedFiles,
          dependencies: fileData.dependencies,
          title: fileData.title,
        };

        await db.workspace.update({
          where: { id: workspaceId, userId },
          data: { fileData: newFileData as never },
        });

        // ── Final done event ──────────────────────────────────────────────

        enqueue(
          sseEvent("done", {
            fileData: newFileData,
            summary: finalSummary || result.outputText,
            creditsRemaining: Math.max(0, user.credits - GENERATION_COST),
          })
        );
      } catch (err) {
        console.error("[improve] error:", err);
        enqueue(
          sseEvent("error", {
            message:
              err instanceof Error ? err.message : "Something went wrong.",
          })
        );
      } finally {
        request.signal.removeEventListener("abort", abortAgent);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300; // for vercel - 300s on Fluid
