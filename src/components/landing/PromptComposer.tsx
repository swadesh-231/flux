"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { ArrowUpRight, CornerDownLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLACEHOLDERS, SUGGESTIONS } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Tallest the field grows before it starts scrolling instead. */
const MAX_HEIGHT = 208;

/** How long each example prompt holds before the next one slides up. */
const ROTATE_MS = 3600;

/**
 * Index into `PLACEHOLDERS`, advancing only while the field is genuinely idle —
 * rotating text under someone's cursor reads as a glitch.
 */
function useRotatingPlaceholder(paused: boolean) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % PLACEHOLDERS.length),
      ROTATE_MS,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  return index;
}

/** Grows the field with its content, up to `MAX_HEIGHT`. */
function useAutoSize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [ref, value]);
}

/**
 * The one interactive island in the hero. Everything around it is server
 * rendered; this needs local state, the router, and the caller's auth state.
 */
export function PromptComposer() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const fieldRef = React.useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  const isEmpty = prompt.trim().length === 0;
  const placeholderIndex = useRotatingPlaceholder(focused || !isEmpty);
  useAutoSize(fieldRef, prompt);

  const submit = () => {
    if (isEmpty || !isSignedIn) return;
    router.push(`/workspace?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  const applySuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    fieldRef.current?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-xl",
          "shadow-[0_24px_70px_-40px_rgb(0_0_0/0.8)]",
          "transition-[border-color,background-color,box-shadow] duration-300",
          focused
            ? "border-brand/40 bg-card/80 shadow-[0_24px_70px_-40px_rgb(0_0_0/0.8),0_0_0_1px_var(--bloom-edge)]"
            : "border-border hover:border-foreground/15",
        )}
      >
        <div className="relative">
          <textarea
            ref={fieldRef}
            rows={1}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Describe the app you want to build"
            className="block w-full resize-none bg-transparent px-5 pb-4 pt-5 text-[0.9375rem] leading-6 text-foreground outline-none"
            style={{ maxHeight: MAX_HEIGHT }}
          />

          {/* The rotating example lives outside the field so it can animate;
              remounting on `key` gives each line its own entrance. */}
          {isEmpty && !focused ? (
            <span
              key={placeholderIndex}
              aria-hidden
              className="pointer-events-none absolute inset-x-5 top-5 animate-rise truncate text-[0.9375rem] leading-6 text-muted-foreground/70 motion-reduce:animate-none"
            >
              {PLACEHOLDERS[placeholderIndex]}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
          <p className="hidden items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70 sm:flex">
            <CornerDownLeft className="size-3" aria-hidden />
            to build
            <span aria-hidden className="mx-1 text-muted-foreground/40">
              /
            </span>
            shift + return for a new line
          </p>

          {isSignedIn ? (
            <Button
              onClick={submit}
              disabled={isEmpty}
              size="sm"
              className="ml-auto rounded-lg"
            >
              Build it
              <ArrowUpRight data-icon="inline-end" aria-hidden />
            </Button>
          ) : (
            <SignInButton mode="modal">
              <Button size="sm" className="ml-auto rounded-lg">
                Build it
                <ArrowUpRight data-icon="inline-end" aria-hidden />
              </Button>
            </SignInButton>
          )}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion.label}>
            <button
              type="button"
              onClick={() => applySuggestion(suggestion.prompt)}
              className={cn(
                "rounded-lg border border-border/80 px-3 py-1.5",
                "font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground",
                "transition-colors hover:border-brand/30 hover:bg-brand/[0.06] hover:text-brand-soft",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              )}
            >
              {suggestion.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PromptComposer;
