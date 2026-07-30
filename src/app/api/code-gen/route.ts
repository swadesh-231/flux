import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

import { aj } from "@/lib/arcjet";
import { GENERATION_COST } from "@/lib/constants";
import {
  AllProvidersUnavailableError,
  streamGeneration,
  type PromptMessage,
} from "@/lib/ai/generate";
import { db } from "@/lib/prisma";
import type { Message, FileData } from "@/types/workspace";


function sseEvent(type: string, payload: object): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}


function extractThoughtLabel(text: string): string | null {
  const boldMatch = text.match(/\*\*([^*]{4,60})\*\*/);
  if (boldMatch) return boldMatch[1].trim();
  const sentence = text.split(/[.\n]/)[0].trim();
  if (sentence.length >= 8 && sentence.length <= 80) return sentence;

  return null;
}

async function validateDependencies(
  deps: Record<string, string>
): Promise<Record<string, string>> {
  const valid: Record<string, string> = {};
  await Promise.all(
    Object.entries(deps).map(async ([pkg, version]) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) valid[pkg] = version;
      } catch {
      }
    })
  );
  return valid;
}


function trimHistory(messages: Message[]): Message[] {
  if (messages.length <= 10) return messages;
  return [messages[0], ...messages.slice(-8)];
}


const SYSTEM_PROMPT = `You are an expert React developer. Your job is to generate complete, working React applications based on user prompts.

RULES:
1. Always respond with a valid JSON object — no markdown fences, no extra text.
2. The JSON must match this exact shape:
{
  "assistantMessage": "<brief explanation of what you built/changed>",
  "title": "<short 2-4 word title for the app, e.g. 'Todo List App'>",
  "files": {
    "/App.js": { "code": "<full file content>" },
    "/components/SomeComponent.js": { "code": "<full file content>" }
  },
  "dependencies": {
    "some-package": "latest"
  }
}
3. Use React (functional components + hooks). Do NOT use TypeScript in generated files.
4. Use Tailwind CSS for all styling. Do not use CSS modules or inline styles unless absolutely necessary.
5. The entry point must always be /App.js and must export a default component.
6. All imports must reference files you include in "files" or packages in "dependencies".
7. Do not include react, react-dom, or tailwindcss in "dependencies" — they are always available.
8. When modifying existing code, include ALL files (both changed and unchanged) in "files".
9. Keep code clean, readable, and production-quality.
10. If the user attaches an image, use it as a design reference and match the layout/style as closely as possible.`;

/**
 * What to show the user when the stream dies.
 *
 * A blanket "Something went wrong" is the wrong default: the most common cause
 * by far is upstream capacity, which the user can act on by retrying, and
 * hiding it makes a Gemini outage look like a bug in the app. Known,
 * user-meaningful failures get their real message; anything unrecognised stays
 * generic in production and is spelled out in development.
 */
function describeStreamError(error: unknown): string {
  if (error instanceof AllProvidersUnavailableError) return error.message;

  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    return `${error.message} (shown because NODE_ENV is not production)`;
  }

  return "Something went wrong. Please try again.";
}

function parseDataUrl(
  value: string
): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

/** Provider-neutral prompt; each adapter renders it in its own wire format. */
function buildPrompt(
  messages: Message[],
  fileData: FileData | null
): PromptMessage[] {
  const trimmed = trimHistory(messages);

  return trimmed.map((msg, idx): PromptMessage => {
    if (msg.role !== "user") {
      return { role: "assistant", text: msg.content };
    }

    let text = msg.content;

    // Attachments arrive as data URLs (ChatPanel encodes them client-side).
    // Decoded to raw base64 here so adapters can send real image bytes rather
    // than a giant blob pasted into the prompt text.
    const image = msg.imageUrl ? parseDataUrl(msg.imageUrl) : null;
    if (image) {
      text = `[The user attached the image above as a design reference.]\n\n${text}`;
    } else if (msg.imageUrl) {
      text = `[The user attached an image, available at this URL — use it directly in the generated app where relevant: ${msg.imageUrl}]\n\n${text}`;
    }

    if (idx === trimmed.length - 1 && fileData) {
      text +=
        "\n\nCurrent project files for context:\n" +
        JSON.stringify(fileData, null, 2);
    }

    return { role: "user", text, ...(image ? { image } : {}) };
  });
}


export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspaceId, userId, title, messages, fileData } = body as {
    workspaceId: string | null;
    userId: string;
    /** Name from the New Project dialog, if the user gave one. */
    title?: string | null;
    messages: Message[];
    fileData: FileData | null;
  };

  // A name the user typed themselves outranks anything the model invents.
  const userTitle = title?.trim().slice(0, 80) || null;

  if (!messages?.length) {
    return Response.json({ message: "No messages provided" }, { status: 400 });
  }


  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const decision = await aj.protect(request, {
    requested: GENERATION_COST,
    userId: clerkId,
    detectPromptInjectionMessage: lastUserMessage,
  });

  if (decision.isDenied()) {
    const isRateLimit = decision.reason.isRateLimit();
    return Response.json(
      {
        message: isRateLimit
          ? "Too many requests. Please slow down."
          : "That prompt was blocked.",
      },
      { status: isRateLimit ? 429 : 400 }
    );
  }

  const user = await db.user.findFirst({
    where: { id: userId, clerkId },
    select: { id: true, credits: true },
  });

  if (!user)
    return Response.json({ message: "User not found" }, { status: 404 });
  if (user.credits < GENERATION_COST) {
    return Response.json({ message: "Insufficient credits" }, { status: 402 });
  }
  if (workspaceId) {
    const owned = await db.workspace.findFirst({
      where: { id: workspaceId, userId },
      select: { id: true },
    });
    if (!owned) {
      return Response.json({ message: "Workspace not found" }, { status: 404 });
    }
  }

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

      try {
        const modelStream = streamGeneration(
          {
            system: SYSTEM_PROMPT,
            messages: buildPrompt(messages, fileData),
          },
          {
            onAttempt: ({ provider, model }) => {
              console.log(`[code-gen] trying ${provider.id}/${model}`);
            },
            onFallback: ({ to }) => {
              if (to) {
                enqueue(
                  sseEvent("status", {
                    message: `Provider busy — trying ${to}…`,
                  })
                );
              }
            },
          }
        );

        let accumulated = ""; // the JSON document
        let lastEmitTime = 0; // throttles reasoning labels

        for await (const chunk of modelStream) {
          if (chunk.kind === "output") {
            accumulated += chunk.text;
            continue;
          }

          // Reasoning — surface a short label, not the whole wall of text.
          const now = Date.now();
          if (now - lastEmitTime > 600) {
            const label = extractThoughtLabel(chunk.text);
            if (label) {
              enqueue(sseEvent("status", { message: label }));
              lastEmitTime = now;
            }
          }
        }
        let parsed: {
          assistantMessage: string;
          title?: string;
          files: Record<string, { code: string }>;
          dependencies: Record<string, string>;
        };

        try {
          parsed = JSON.parse(accumulated);
        } catch {
          enqueue(
            sseEvent("error", {
              message: "AI returned invalid JSON. Please try again.",
            })
          );
          return;
        }

        const { assistantMessage, title: aiTitle, files, dependencies } = parsed;

        if (!files || typeof files !== "object" || !Object.keys(files).length) {
          enqueue(
            sseEvent("error", {
              message: "AI response missing files. Please try again.",
            })
          );
          return;
        }
        enqueue(sseEvent("status", { message: "Validating packages…" }));
        const validatedDeps = await validateDependencies(dependencies ?? {});
        const newFileData: FileData = {
          files,
          dependencies: validatedDeps,
          title: aiTitle,
        };

        enqueue(sseEvent("status", { message: "Saving…" }));

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

        const lastUserTurn = messages[messages.length - 1];
        const resolvedTitle = userTitle ?? aiTitle ?? null;
        const updatedMessages: Message[] = [
          ...messages,
          { role: "assistant", content: assistantMessage },
        ];

        const workspace = workspaceId
          ? await db.workspace.update({
              where: { id: workspaceId, userId },
              data: {
                // The user's own name is fixed; otherwise let later titles
                // from the model refresh it.
                ...(resolvedTitle ? { title: resolvedTitle } : {}),
                messages: updatedMessages as never,
                fileData: newFileData as never,
              },
            })
          : await db.workspace.create({
              data: {
                userId,
                title: resolvedTitle ?? lastUserTurn.content.slice(0, 80),
                messages: updatedMessages as never,
                fileData: newFileData as never,
              },
            });

        // ── Emit final result ──────────────────────────────────────────────────

        enqueue(
          sseEvent("done", {
            workspaceId: workspace.id,
            assistantMessage,
            fileData: newFileData,
            creditsRemaining: Math.max(0, user.credits - GENERATION_COST),
          })
        );
      } catch (err) {
        console.error("[code-gen] stream error:", err);
        enqueue(
          sseEvent("error", {
            message: describeStreamError(err),
          })
        );
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Stops nginx-style proxies buffering the stream into one lump.
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300; // for vercel - 300s on Fluid
