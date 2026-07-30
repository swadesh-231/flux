"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useUser } from "@clerk/nextjs";
import {
  ArrowUp,
  Check,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { FluxMark } from "@/components/base/Logo";
import { Button } from "@/components/ui/button";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Message, StatusStep } from "@/types/workspace";

import { PricingModal } from "./PricingModal";

/** Reads a file as a `data:` URL. There is no object storage in this stack. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  isImproving: boolean;
  statusLog: StatusStep[];
  credits: number;
  initialPrompt: string | null;
  onGenerate: (prompt: string, imageUrl?: string) => Promise<void>;
  onStop: () => void;
  appTitle: string | null;
}

export function ChatPanel({
  messages,
  isGenerating,
  isImproving,
  statusLog,
  credits,
  initialPrompt,
  onGenerate,
  onStop,
  appTitle,
}: ChatPanelProps) {
  const { user } = useUser();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [input, setInput] = useState("");
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const hasAutoSubmittedRef = useRef(false);
  const noCredits = credits <= 0;

  // The last message is the live-streaming assistant placeholder during improve
  const lastMsg = messages[messages.length - 1];
  const isStreamingAssistant = isImproving && lastMsg?.role === "assistant";

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isGenerating, isImproving]);

  useEffect(() => {
    if (!initialPrompt || hasAutoSubmittedRef.current || messages.length > 0)
      return;
    hasAutoSubmittedRef.current = true;
    onGenerate(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating || isImproving || noCredits) return;
    setInput("");
    setPendingImageUrl(null);
    await onGenerate(trimmed, pendingImageUrl ?? undefined);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        `Image is too large — keep it under ${Math.round(
          MAX_IMAGE_BYTES / 1024 / 1024
        )} MB.`
      );
      return;
    }

    setIsUploading(true);
    try {
      setPendingImageUrl(await readAsDataUrl(file));
    } catch {
      toast.error("Couldn't read that image.");
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit =
    input.trim().length > 0 && !isGenerating && !isImproving && !noCredits;


  const isBusy = isGenerating || isImproving;

  return (
    <aside className="flex h-full min-h-0 w-[340px] shrink-0 flex-col border-r border-border bg-card/30">
      {/* ── Header ── */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <p className="truncate text-[0.8125rem] font-medium tracking-tight text-foreground/90">
          {appTitle ?? "Untitled app"}
        </p>

        <PricingModal reason={noCredits ? "credits" : "upgrade"}>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5",
              "font-mono text-[0.625rem] uppercase tracking-[0.14em] transition-colors",
              noCredits
                ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "border-border text-muted-foreground hover:border-brand/30 hover:text-brand",
            )}
          >
            {noCredits ? "0 left · upgrade" : `${credits} left`}
          </span>
        </PricingModal>
      </header>

      {/* ── Transcript ── */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [&::-webkit-scrollbar]:hidden"
      >
        {messages.length === 0 && !isGenerating && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <FluxMark className="size-7 text-brand/40" />
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
              Describe what you want to build.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/60">
              Flux writes the code and renders it live.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {messages.map((msg, i) => {
            const isLiveStream =
              i === messages.length - 1 && isStreamingAssistant;

            if (msg.role === "user") {
              return (
                <div key={i} className="flex items-start justify-end gap-2">
                  <div className="max-w-[85%] space-y-1.5">
                    {msg.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={msg.imageUrl}
                        alt="Attached reference"
                        className="max-h-40 w-full rounded-xl border border-border object-cover"
                      />
                    )}
                    <div className="rounded-2xl rounded-br-md border border-border bg-muted/60 px-3.5 py-2.5">
                      <p className="wrap-break-word text-[0.8125rem] leading-relaxed text-foreground/90">
                        {msg.content}
                      </p>
                    </div>
                  </div>

                  {user?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.imageUrl}
                      alt={user.fullName ?? "You"}
                      className="mt-0.5 size-6 shrink-0 rounded-full"
                    />
                  ) : (
                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[0.625rem] text-muted-foreground">
                      {user?.firstName?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={i} className="flex items-start gap-2.5">
                <FluxMark className="mt-0.5 size-6 shrink-0 text-brand" />

                <div className="min-w-0 flex-1 pt-0.5">
                  {isLiveStream && !msg.content ? (
                    <p className="animate-pulse font-mono text-[0.625rem] uppercase tracking-[0.16em] text-brand">
                      Agent thinking
                    </p>
                  ) : isLiveStream ? (
                    <>
                      <p className="mb-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-brand">
                        Agent reasoning
                      </p>
                      <p className="wrap-break-word text-xs leading-relaxed text-muted-foreground">
                        {msg.content}
                        <span className="ml-0.5 inline-block h-3 w-px animate-[blink_1s_ease-in-out_infinite] bg-brand align-middle" />
                      </p>
                    </>
                  ) : (
                    <div className="wrap-break-word text-[0.8125rem] leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.6875rem] [&_code]:break-all [&_code]:text-brand-soft [&_li]:my-0.5 [&_p]:my-1.5 [&_pre]:overflow-x-auto! [&_pre]:whitespace-pre-wrap! [&_strong]:text-foreground/90 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Live status steps — normal generation only */}
          {isGenerating && (
            <div className="flex items-start gap-2.5">
              <FluxMark className="mt-0.5 size-6 shrink-0 text-brand" />
              <ul className="min-w-0 flex-1 space-y-2 pt-1">
                {statusLog.map((step, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="flex size-3 shrink-0 items-center justify-center">
                      {step.status === "running" ? (
                        <span
                          aria-hidden
                          className="size-3 animate-spin rounded-full border border-brand/25 border-t-brand"
                        />
                      ) : (
                        <Check
                          className="size-3 text-muted-foreground/50"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-xs transition-colors duration-300",
                        step.status === "running"
                          ? "text-foreground/80"
                          : "text-muted-foreground/50",
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Out of credits ── */}
      {noCredits && (
        <div className="mx-3 mb-2 shrink-0 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-3.5 py-3">
          <p className="text-xs font-medium text-foreground/80">
            You&apos;ve used all your credits
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Upgrade to keep building.
          </p>
          <PricingModal reason="credits">
            <span className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90">
              <Sparkles className="size-3" aria-hidden />
              View plans
            </span>
          </PricingModal>
        </div>
      )}

      {/* ── Composer ── */}
      <div className="shrink-0 border-t border-border p-3">
        {pendingImageUrl && (
          <div className="relative mb-2 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImageUrl}
              alt="Pending attachment"
              className="size-16 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => setPendingImageUrl(null)}
              aria-label="Remove attachment"
              className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-2.5" aria-hidden />
            </button>
          </div>
        )}

        <div
          className={cn(
            "rounded-xl border bg-card/60 transition-colors",
            noCredits
              ? "border-border opacity-60"
              : "border-border focus-within:border-brand/40",
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBusy || noCredits}
            aria-label="Describe what to build or change"
            placeholder={
              noCredits
                ? "Upgrade to keep building…"
                : isImproving
                  ? "Agent is improving your app…"
                  : isGenerating
                    ? "Building…"
                    : messages.length
                      ? "Ask for a change…"
                      : "Describe what you want to build…"
            }
            rows={1}
            className="w-full resize-none bg-transparent px-3.5 pb-2 pt-3 text-[0.8125rem] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            style={{ maxHeight: 160 }}
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-lg"
              onClick={() => fileRef.current?.click()}
              disabled={isBusy || isUploading || noCredits}
              aria-label="Attach a reference image"
            >
              {isUploading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Paperclip aria-hidden />
              )}
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {isBusy ? (
              <Button
                size="icon-xs"
                variant="outline"
                className="rounded-lg"
                onClick={onStop}
                aria-label="Stop generating"
              >
                <Square className="fill-current" aria-hidden />
              </Button>
            ) : (
              <Button
                size="icon-xs"
                className="rounded-lg"
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-label="Send"
              >
                <ArrowUp aria-hidden />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-muted-foreground/50">
          {isBusy ? "Stop to cancel" : "Return to send · Shift + Return for a new line"}
        </p>
      </div>
    </aside>
  );
}
