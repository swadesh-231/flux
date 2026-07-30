"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** easeOutQuint — moves off the mark fast, then settles without bounce. */
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * True once the page has left the top. Read once on mount as well, so a
 * restored scroll position (reload mid-page, back-navigation) paints condensed
 * instead of snapping into it a frame later.
 */
function useCondensed(threshold = 8) {
  const [condensed, setCondensed] = React.useState(false);

  React.useEffect(() => {
    const read = () => setCondensed(window.scrollY > threshold);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [threshold]);

  return condensed;
}

/**
 * A frosted pane floating clear of the viewport edge. Squared, to match the
 * `rounded-none` language of Button and Badge.
 *
 * Scrolling tightens it rather than restyling it: it rises, narrows, loses a
 * little height, and the glass gets denser. Descendants can follow along with
 * `group-data-[state=condensed]/header:`.
 *
 * Only the shell is client-side — the nav arrives as server-rendered children.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const condensed = useCondensed();
  const state = condensed ? "condensed" : "top";

  return (
    <header
      data-state={state}
      // Transparent to the pointer, so the gutters either side of the pane
      // don't swallow clicks on the content beneath.
      className={cn(
        "group/header pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center",
        "px-4 pt-4 transition-[padding] duration-500 motion-reduce:transition-none",
        EASE,
        "data-[state=condensed]:pt-2.5",
      )}
    >
      <div
        data-state={state}
        className={cn(
          "pointer-events-auto relative flex h-14 w-full max-w-6xl items-center",
          "rounded-full border border-white/10 bg-clip-padding",
          "bg-background/55 backdrop-blur-xl backdrop-saturate-150",
          "shadow-[0_8px_28px_-16px_rgb(0_0_0/0.5)]",
          "transition-[max-width,height,background-color,box-shadow] duration-500",
          "motion-reduce:transition-none",
          EASE,
          // The squeeze.
          "data-[state=condensed]:h-12 data-[state=condensed]:max-w-5xl",
          "data-[state=condensed]:bg-background/85",
          "data-[state=condensed]:shadow-[0_18px_44px_-20px_rgb(0_0_0/0.7)]",
        )}
      >
        {/* Light falling across the top face of the pane. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit]",
            "bg-linear-to-b from-white/[0.06] via-white/[0.015] to-transparent",
          )}
        />

        {/* Lit top edge. Held inside the corner radius so it doesn't cut
            across the curve. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-10 top-0 h-px",
            "bg-linear-to-r from-transparent via-white/25 to-transparent",
          )}
        />

        {children}
      </div>
    </header>
  );
}

export default HeaderShell;
