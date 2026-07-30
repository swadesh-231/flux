"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

import { MIN_GENERATIONS_REQUIRED } from "@/lib/constants";
import type {
  Message,
  FileData,
  StatusStep,
  WorkspaceData,
} from "@/types/workspace";

import { ChatPanel } from "./ChatPanel";
import { CodePanel } from "./CodePanel";
import { MobileBlocker } from "./MobileBlocker";

interface WorkspaceClientProps {
  initialPrompt: string | null;
  /** Name typed into the New Project dialog, before any row exists. */
  initialTitle: string | null;
  workspace: WorkspaceData | null;
  userCredits: number;
  userId: string;
  userPlan: string;
}

/**
 * One `data: {...}` frame from either generation route, or `null` if the line
 * is a keep-alive, a partial write, or otherwise not JSON.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSseLine(line: string): any | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

function parseMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is Message =>
      typeof m === "object" && m !== null && "role" in m && "content" in m
  );
}

function parseFileData(raw: unknown): FileData | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (!f.files || !f.dependencies) return null;
  return raw as FileData;
}

export function WorkspaceClient({
  initialPrompt,
  initialTitle,
  workspace,
  userCredits,
  userId,
  userPlan,
}: WorkspaceClientProps) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    workspace?.id ?? null
  );
  const [messages, setMessages] = useState<Message[]>(
    parseMessages(workspace?.messages)
  );
  const [fileData, setFileData] = useState<FileData | null>(
    parseFileData(workspace?.fileData)
  );
  const [credits, setCredits] = useState(userCredits);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusLog, setStatusLog] = useState<StatusStep[]>([]);
  const [isImproving, setIsImproving] = useState(false);

  // AbortController refs — used to cancel in-flight streams
  const generateAbortRef = useRef<AbortController | null>(null);
  const improveAbortRef = useRef<AbortController | null>(null);

  // Refs to avoid stale closures in callbacks
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const workspaceIdRef = useRef<string | null>(workspaceId);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  // fileData ref — so handleImprove never closes over stale fileData
  // even as file_patch events stream in
  const fileDataRef = useRef<FileData | null>(fileData);
  useEffect(() => {
    fileDataRef.current = fileData;
  }, [fileData]);

  // Only the last few steps are kept. The model emits a reasoning label every
  // second or so, and an uncapped list grew past a dozen lines and pushed the
  // conversation out of view.
  const MAX_VISIBLE_STEPS = 4;

  const pushStep = (label: string) => {
    setStatusLog((prev) =>
      [
        ...prev.map((s, i) =>
          i === prev.length - 1 ? { ...s, status: "done" as const } : s
        ),
        { label, status: "running" as const },
      ].slice(-MAX_VISIBLE_STEPS)
    );
  };

  const completeSteps = () => {
    setStatusLog((prev) =>
      prev.map((s, i) =>
        i === prev.length - 1 ? { ...s, status: "done" as const } : s
      )
    );
  };

  const handleGenerate = useCallback(
    async (prompt: string, imageUrl?: string, intent: "build" | "fix" = "build") => {
      if (isGenerating) return;
      if (credits < MIN_GENERATIONS_REQUIRED) return;

      const userMessage: Message = {
        role: "user",
        content: prompt,
        ...(imageUrl ? { imageUrl } : {}),
      };

      const currentMessages = messagesRef.current;
      const currentWorkspaceId = workspaceIdRef.current;

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);
      setStatusLog([{ label: "Thinking…", status: "running" }]);

      // Create a fresh AbortController for this request
      const abortController = new AbortController();
      generateAbortRef.current = abortController;

      try {
        const conversationHistory = [...currentMessages, userMessage];

        const res = await fetch("/api/code-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            userId,
            intent,
            title: initialTitle,
            messages: conversationHistory,
            fileData: fileDataRef.current,
          }),
        });

        if (res.status === 402) {
          toast.error("You're out of credits. Upgrade to keep building.");
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        if (res.status === 429) {
          toast.error("Too many requests. Please slow down.");
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        if (!res.ok || !res.body) throw new Error("Generation failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            // Parsing is guarded; handling is not. Wrapping both would let the
            // catch swallow the `error` event's throw and end the stream in
            // silence.
            const event = parseSseLine(line);
            if (!event) continue;

            if (event.type === "status") {
              pushStep(event.message);
            } else if (event.type === "done") {
              completeSteps();
              setWorkspaceId(event.workspaceId);
              setFileData(event.fileData);
              setCredits(event.creditsRemaining);
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: event.assistantMessage },
              ]);
              window.history.replaceState(
                null,
                "",
                `/workspace?id=${event.workspaceId}`
              );
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      } catch (err) {
        // User-initiated stop — silently roll back the user message
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Something went wrong."
        );
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        generateAbortRef.current = null;
        setIsGenerating(false);
        setStatusLog([]);
      }
    },
    // messages, workspaceId, and fileData are read through refs rather than
    // listed here, so a long stream never re-creates this callback mid-flight.
    [credits, initialTitle, isGenerating, userId]
  );

  const handleImprove = useCallback(
    async (userRequest: string) => {
      if (isGenerating || isImproving) return;
      if (credits < MIN_GENERATIONS_REQUIRED) return;
      if (!workspaceIdRef.current) return;

      // Read fileData from ref — never stale, never causes recreating this fn
      const currentFileData = fileDataRef.current;
      if (!currentFileData) return;

      setIsImproving(true);

      setMessages((prev) => [
        ...prev,
        { role: "user", content: userRequest },
        { role: "assistant", content: "" }, // placeholder, updated live
      ]);

      // Create a fresh AbortController for this request
      const abortController = new AbortController();
      improveAbortRef.current = abortController;

      try {
        const res = await fetch("/api/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            userId,
            workspaceId: workspaceIdRef.current,
            userRequest,
            fileData: currentFileData,
          }),
        });

        if (res.status === 403) {
          // Must match the gate in /api/improve, which is Pro-only.
          toast.error("Improve with Agent is a Pro feature. Upgrade to use it.");
          setMessages((prev) => prev.slice(0, -2));
          return;
        }
        if (res.status === 402) {
          toast.error("Not enough credits.");
          setMessages((prev) => prev.slice(0, -2));
          return;
        }
        if (res.status === 429) {
          toast.error("Too many requests. Please slow down.");
          setMessages((prev) => prev.slice(0, -2));
          return;
        }
        if (!res.ok || !res.body) throw new Error("Improve failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedThinking = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseSseLine(line);
            if (!event) continue;

            if (event.type === "thinking") {
              // Stream agent reasoning into the placeholder assistant message
              accumulatedThinking += event.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: accumulatedThinking,
                };
                return updated;
              });
            } else if (event.type === "file_patch") {
              // Deliberately ignored mid-stream. Writing fileData on every
              // patch feeds SandpackProvider a new file set and can remount it
              // mid-run; the `done` event carries the complete result.
            } else if (event.type === "done") {
              // Apply all patches at once now that the stream is complete
              setFileData(event.fileData);
              setCredits(event.creditsRemaining);
              // Replace thinking text with clean summary
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: event.summary,
                };
                return updated;
              });
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      } catch (err) {
        // User-initiated stop — silently roll back the user + placeholder messages
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) => prev.slice(0, -2));
          return;
        }
        toast.error(err instanceof Error ? err.message : "Improve failed.");
        setMessages((prev) => prev.slice(0, -2));
      } finally {
        improveAbortRef.current = null;
        setIsImproving(false);
      }
    },
    // workspaceId and fileData come from refs — see handleGenerate.
    [credits, isGenerating, isImproving, userId]
  );

  // Cancel whichever stream is currently in-flight
  const handleStop = useCallback(() => {
    generateAbortRef.current?.abort();
    improveAbortRef.current?.abort();
  }, []);

  return (
    <>
      {/* Mobile blocker — visible only on small screens */}
      <div className="flex min-h-[calc(100dvh-5.5rem)] md:hidden">
        <MobileBlocker />
      </div>

      {/* Workspace — visible only on md+ screens.
          This needs a *definite* height: `body` is `min-h-full`, so a `flex-1`
          here has no resolved container height to size against and the panel
          grows to fit the code editor, scrolling the whole page. 5.5rem is the
          `pt-22` the app shell uses to clear the fixed header.
          The panes below must each carry `min-h-0`, or their default
          `min-height: auto` refuses to shrink and pushes content out the
          bottom. */}
      <div className="hidden h-[calc(100dvh-5.5rem)] overflow-hidden bg-background md:flex">
        <ChatPanel
          isImproving={isImproving}
          messages={messages}
          isGenerating={isGenerating}
          statusLog={statusLog}
          credits={credits}
          initialPrompt={initialPrompt}
          onGenerate={handleGenerate}
          onStop={handleStop}
          appTitle={workspace?.title ?? initialTitle ?? fileData?.title ?? null}
        />
        <div className="w-px shrink-0 bg-white/6" />
        <CodePanel
          fileData={fileData}
          isGenerating={isGenerating}
          statusLog={statusLog}
          onImprove={handleImprove}
          onFixError={(error) =>
            handleGenerate(
              `There is an error in the preview:\n\n\`\`\`\n${error}\n\`\`\`\n\nPlease fix it.`,
              undefined,
              "fix"
            )
          }
          appTitle={workspace?.title ?? initialTitle ?? fileData?.title ?? null}
          isImproving={isImproving}
          isProUser={userPlan === "pro"}
        />
      </div>
    </>
  );
}