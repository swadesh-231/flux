# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **bun** (`bun.lock`); there is no test setup.

```bash
bun dev                          # dev server (Turbopack) on :3000
bun run build                    # production build
bun run lint                     # eslint (flat config, eslint-config-next 16)
npx tsc --noEmit                 # typecheck (tsconfig is noEmit-only)
bun --bun run prisma <command>    # Prisma CLI — prisma.config.ts assumes this exact form
```

## What this is

Flux is an agentic app builder: the user describes an app, an AI agent generates it, and a live
preview renders in-browser. Only the marketing landing page exists so far. `src/app/page.tsx`
links to `/workspace`, `/projects`, and `/billing` — **none of those routes exist yet**.

## Next.js 16 — read the bundled docs

Version-specific breaking changes matter here. Authoritative docs ship inside the install at
`node_modules/next/dist/docs/` (`01-app/` for App Router). Consult them before writing code
rather than relying on remembered Next.js conventions. Already visible in this repo:

- `middleware.ts` is deprecated and renamed — Clerk's middleware lives in **`src/proxy.ts`**.

## Architecture

**Auth + billing: Clerk, and Clerk owns the subscription state.** `ClerkProvider` wraps the root
layout with the `dark` theme from `@clerk/ui/themes`. `src/proxy.ts` runs `clerkMiddleware()`.
There is no local user or subscription table — plan membership is read client-side from
`useAuth().has({ plan: "pro" })` and gated in markup with Clerk's `<Show when="signed-in">`.

Consequence: `src/lib/constants.ts` is the seam between the UI and Clerk's dashboard. `PRICING_PLANS[].key`
must match the Clerk plan slug, and `planId` holds the literal Clerk `cplan_…` id. `PLANS` keys are
**declared in tier order**, and `page.tsx` derives upgrade/downgrade direction from that key order
(`planRank`) — reordering the object changes behaviour.

**Database: Prisma 7 with the new `prisma-client` generator.** The schema (`prisma/schema.prisma`)
is currently models-free, and `output = "../app/generated/prisma"` resolves to `<repo>/app/generated/prisma`
(gitignored, not yet generated). Once generated, `PrismaClient` is imported from that output path,
not from `@prisma/client`. Postgres is reached through `@prisma/adapter-pg` + `pg` (Neon), driven by
`DATABASE_URL`.

**Installed but not yet wired into `src/`:** `@arcjet/next` (`ARCJET_KEY` is set), `@cline/sdk`
(the intended coding-agent runtime), and the Prisma client.

**Env vars in use:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `ARCJET_KEY`.

## Styling and components

**Tailwind v4, CSS-first.** No `tailwind.config.*` exists — the whole theme is `@theme inline` plus
`:root`/`.dark` oklch tokens in `src/app/globals.css`, loaded via `@tailwindcss/postcss`. Dark mode is
a class variant (`@custom-variant dark`) driven by `next-themes`; `defaultTheme` is `dark`.

**shadcn in `radix-sera` style with the `taupe` base colour** (`components.json`). This style is not
default shadcn — its `Button`/`Badge` are `rounded-none`, uppercase, tracking-widest micro-type, and
icons inside a Button are positioned by a **data attribute, not a class**:

```tsx
<Button>Generate <ArrowRight data-icon="inline-end" aria-hidden /></Button>
```

The variants key off `has-data-[icon=inline-end]` to adjust padding, so dropping that attribute
silently breaks spacing. The landing page deliberately overrides the squared look with
`rounded-full`/`rounded-2xl` — follow whichever language the surrounding section already uses.

A second registry, `@animate-ui` (`https://animate-ui.com/r/{name}.json`), supplies
`src/components/animate-ui/` — keep registry-generated files separate from hand-written ones.

**Component layout:**
- `src/components/ui/` — shadcn primitives, regenerable; avoid hand-editing.
- `src/components/base/` — app chrome. `Header.tsx` is a server component; the scroll behaviour is
  isolated in the `"use client"` `HeaderShell.tsx`, which exposes state as `data-state="condensed|top"`
  on a `group/header`. Descendants animate by reacting to
  `group-data-[state=condensed]/header:…` rather than by becoming client components themselves —
  preserve that split when adding to the header.
- `src/components/reusables.tsx` — typography primitives (`GrayTitle`, `BlueTitle`, `SectionLabel`,
  `SectionHeading`). Headings pair a white/90 line with a blue gradient line; use these instead of
  re-inlining the gradient classes.
- `src/lib/data.ts` — landing-page copy (features, steps, prompt placeholders, suggestions).
  Keep marketing content out of components.

The fixed header is cleared by `pt-22` on `<main>` in `layout.tsx` (`pt-4` inset + `h-14` pane + gap);
changing the header's height or inset means updating that value.
