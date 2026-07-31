import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Primitives for the marketing surface.
 *
 * One accent only — the brand gold, held in `--brand` — used for the emphasised
 * phrase of a heading, section labels, and small confirmations. Everything else
 * is warm neutral, so the gold still means something when it appears.
 *
 * All of it resolves through theme tokens (`brand`, `foreground`,
 * `muted-foreground`, `border`) rather than literal colours, so the surface
 * follows `globals.css`.
 */

/**
 * Consistent vertical rhythm and a centred measure for every band of the page.
 *
 * The gutter is *inside* the `max-w-6xl` track rather than outside it, which is
 * what makes the page line up with the header: the header pane is also
 * `max-w-6xl` and pads its nav inwards by the same `px-6`, so once both hit
 * their max width the logo sits exactly above the first character of every
 * section. Padding the section from the outside instead put the whole page
 * 1.5rem to the left of the wordmark.
 *
 * `SECTION_CONTAINER` is exported so surfaces that cannot use `Section` — the
 * footer, the signed-in pages — can align to the same track.
 */
export const SECTION_CONTAINER = "mx-auto w-full max-w-6xl px-6";

export function Section({
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentProps<"section"> & { containerClassName?: string }) {
  return (
    // Vertical padding is half the gap you actually see: two stacked sections
    // contribute one `pb` and one `pt` each. At `py-24 sm:py-32` that was 256px
    // of dead space between every band, which read as the page having come
    // apart rather than as breathing room.
    // `scroll-mt` only has to clear the condensed header (2.5rem inset + 3rem
    // pane) — the section's own top padding supplies the breathing room, so a
    // larger value just drops the eyebrow into the middle of the viewport.
    <section className={cn("scroll-mt-20 py-16 sm:py-24", className)} {...props}>
      <div className={cn(SECTION_CONTAINER, containerClassName)}>{children}</div>
    </section>
  );
}

/** Letterspaced mono micro-label in gold. Names a section without shouting. */
export function Eyebrow({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-brand",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * The emphasised phrase in a heading: serif italic *and* gold, so the stress
 * carries at any size. The gradient runs light-to-deep across the phrase, which
 * keeps a long line from flattening into a single block of colour.
 */
export function Accent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "bg-linear-to-br from-brand-soft via-brand to-brand-deep bg-clip-text font-heading italic text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Hero headline. Fluid, tight, and balanced across breakpoints. */
export function Display({
  className,
  children,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "font-heading text-balance text-[clamp(2.5rem,7vw,4.25rem)] font-normal leading-[1.05] tracking-[-0.02em] text-foreground/90",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

/**
 * Eyebrow, heading, and optional lead paragraph as one block, so every section
 * opens at the same rhythm.
 *
 * `accent` is appended to `title` and set in serif italic; keep it to the last
 * few words, where the line break can fall naturally.
 */
export function SectionHeader({
  eyebrow,
  title,
  accent,
  lead,
  align = "center",
  className,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lead?: string;
  align?: "center" | "start";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <header
      className={cn(
        "flex flex-col",
        centered ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <Eyebrow>{eyebrow}</Eyebrow>

      <h2 className="mt-5 max-w-2xl text-balance font-heading text-[clamp(1.875rem,4vw,2.75rem)] font-normal leading-[1.1] tracking-[-0.015em] text-foreground/90">
        {title} {accent ? <Accent>{accent}</Accent> : null}
      </h2>

      {lead ? (
        <p
          className={cn(
            "mt-5 max-w-lg text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground",
            centered && "mx-auto",
          )}
        >
          {lead}
        </p>
      ) : null}
    </header>
  );
}
