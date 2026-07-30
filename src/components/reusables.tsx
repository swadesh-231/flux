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

/** Consistent vertical rhythm and a centred measure for every band of the page. */
export function Section({
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentProps<"section"> & { containerClassName?: string }) {
  return (
    <section
      className={cn("scroll-mt-28 px-6 py-24 sm:py-32", className)}
      {...props}
    >
      <div className={cn("mx-auto w-full max-w-6xl", containerClassName)}>
        {children}
      </div>
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
