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
bun --bun run prisma migrate deploy   # apply prisma/migrations to DATABASE_URL
```

## What this is

Flux is an agentic app builder: the user describes an app, an AI agent generates it, and a live
preview renders in-browser. The prompt on the landing page hands off to `/workspace`, which streams
a generation and renders the result in Sandpack.

**Route groups own the page chrome, not the root layout.** `src/app/layout.tsx` is providers only
(Clerk, theme, `Toaster`). Each group supplies its own:

- `(marketing)/` — the landing page. Header + `<main className="pt-22">` + Footer.
- `(auth)/` — Clerk's `<SignIn>` / `<SignUp>` catch-all routes. Header + centred column.
- `(main)/` — the signed-in app (`/workspace`, `/projects`, `/billing`). Header, no Footer. Calls
  `auth.protect()` and then `checkUser()`, so everything underneath can assume a local `User` row.

Adding a route means picking a group; dropping one into `src/app/` directly gets no header at all.

## Next.js 16 — read the bundled docs

Version-specific breaking changes matter here. Authoritative docs ship inside the install at
`node_modules/next/dist/docs/` (`01-app/` for App Router). Consult them before writing code
rather than relying on remembered Next.js conventions. Already visible in this repo:

- `middleware.ts` is deprecated and renamed — Clerk's middleware lives in **`src/proxy.ts`**, and
  it runs on the **Node.js runtime** by default (so Arcjet's Node rules work there).
- A root-level `app/` directory would be read as a second App Router and collide with `src/app`.
  Nothing may generate into `<repo>/app` — see the Prisma output path below.

## Architecture

**Auth + billing: Clerk, and Clerk owns the subscription state.** `ClerkProvider` wraps the root
layout with the `dark` theme from `@clerk/ui/themes`. `src/proxy.ts` runs `clerkMiddleware()` for
Arcjet only — **`createRouteMatcher` is deprecated in Clerk 7**, so auth gating is resource-based:
`auth.protect()` in `(main)/layout.tsx`, plus an `auth()` check inside every server action and route
handler. Do not reintroduce path-matching auth in the proxy.

`User.plan` and `User.credits` mirror Clerk onto the database. `src/lib/checkUser.ts` reconciles
them on every authenticated page view: it creates the row on first sight, and on a plan change tops
credits up by the delta (upgrades only). The top-up is idempotent — the `updateMany` is guarded on
the *old* plan, so concurrent requests grant it once.

**`checkUser` is wrapped in React `cache()`, and that is load-bearing — do not unwrap it.** A layout
and the page beneath it render *in parallel*, so `(main)/layout.tsx` and a page's own lookup both
reach it on a first visit. Uncached, both read "no row" and both `create()`, and one dies on the
`clerkId` unique constraint. The `create` additionally catches P2002 and re-reads, which covers the
same race across two separate requests. Any new "fetch the current user" helper should call
`checkUser()` on the miss path rather than redirecting.

Consequence: `src/lib/constants.ts` is the seam between the UI and Clerk's dashboard, and the two
identifiers are **not interchangeable**: checkout (`<CheckoutButton planId>`) takes the Clerk
`cplan_…` id from `clerkPlanId`, while detection (`has({ plan })`) takes the plan **slug**, which is
the `PLANS` key. Both must match the dashboard. `clerkPlanId` is `null` on the free tier, and that
null is also what marks a tier as "not a checkout" — `resolveActivePlanKey` skips it, which is why
the free plan's slug being `free_user` upstream costs nothing.

`PLANS` keys are **declared in tier order**, and both pricing surfaces derive upgrade/downgrade
direction from that key order (`planRank`) — reordering the object changes behaviour.

Three things have to agree on the per-plan generation count, and nothing enforces it automatically:
`PLANS[*].generations`, the feature text on the plan in the Clerk dashboard (which `/billing`
renders via Clerk's own `<PricingTable/>`), and — for the free tier — `User.credits`'s `@default` in
the schema. They are currently 10 / 50 / 100. Changing one means changing all of them, plus a
migration for the default. Note that Prisma applies scalar `@default`s **client-side**, so a schema
default change needs `prisma generate`, not just `migrate deploy`.

**Database: Prisma 7 with the new `prisma-client` generator.** `output = "../src/generated/prisma"`,
so `PrismaClient` is imported as `@/generated/prisma/client` — **not** from `@prisma/client`. The
directory is gitignored and eslint-ignored; run `bun --bun run prisma generate` after pulling. The
connection URL lives in `prisma.config.ts` (`datasource.url`), not in the schema. Postgres is reached
through `@prisma/adapter-pg` + `pg` (Neon), driven by `DATABASE_URL`.

**Generation routes.** Two streaming SSE endpoints, both `runtime = "nodejs"`, both charging
`GENERATION_COST` credits:

- `POST /api/code-gen` — Gemini (`@google/genai`) returns the whole app as one JSON payload.
  Attached images arrive as `data:` URLs and are forwarded as `inlineData` parts.
- `POST /api/improve` — the `@cline/sdk` agent loop edits files in place through an `update_file`
  tool. Pro-only. `next.config.ts` lists the `@cline/*` packages in `serverExternalPackages`.

**`GEMINI_MODELS` is a list, not a single id, and that matters.** An individual Gemini model can
return `503 UNAVAILABLE` for hours at a stretch under demand — `gemini-3.5-flash` did exactly that,
which took the whole product down. `src/lib/gemini.ts` walks the list, retrying transient failures
(503/500/429) with backoff before moving to the next model; put the model you actually want first.
`/api/improve` does the same around the Cline agent, but only retries while `hasAppliedWork` is
false — once `update_file` has landed an edit, re-running from scratch would compound it. Cline
wraps provider errors in its own layer, so that path matches on the message (`isTransientLlmMessage`)
rather than on `ApiError`.

Do not collapse a stream failure into a blanket "Something went wrong": upstream capacity is the
most likely cause and the user can act on it by retrying. `describeStreamError` keeps known failures
legible, and spells out unrecognised ones outside production.

Both charge with a conditional `updateMany` (`credits: { gte: cost }`) rather than a plain
decrement, so concurrent runs cannot drive a balance negative, and both verify workspace ownership
*before* charging. On the client, SSE frames are parsed inside a `try`/`catch` but **handled outside
it** — wrapping both lets the catch swallow the `error` event and end the stream in silence.

**Env vars in use:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `DATABASE_URL`, `ARCJET_KEY`,
`GEMINI_API_KEY`.

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
- `src/components/reusables.tsx` — typography primitives: `Section`, `Eyebrow`, `Accent`, `Display`,
  `SectionHeader`. **One accent only — the brand gold in `--brand`.** `Accent` is the gold gradient
  phrase; use it instead of re-inlining the gradient classes, and don't introduce a second accent
  hue (an earlier pass had blue and violet scattered through the workspace).
- `src/components/project/` — the workspace surface. File names match their exported component.
- `src/lib/data.ts` — landing-page copy (features, steps, prompt placeholders, suggestions).
  Keep marketing content out of components.

The fixed header is cleared by `pt-22` on `<main>` in each route-group layout (`pt-4` inset + `h-14`
pane + gap); changing the header's height or inset means updating every group, plus the
`h-[calc(100dvh-5.5rem)]` the workspace uses to fit both panels on one screen.

Arbitrary animations (`animate-[shimmer_…]`, `animate-[blink_…]`) still need their `@keyframes`
declared in `globals.css` — Tailwind does not invent them from the class name.

**Sandpack (`CodePanel`) has three traps, all previously hit:**

1. **Do not use `<SandpackLayout>`.** It sizes children through a `> .sp-stack` child selector, so
   the moment you wrap a pane in anything — a tab panel, a flex row — the panes lose their height
   and render stacked on top of each other. Lay `SandpackPreview` / `SandpackCodeEditor` out in
   your own flex containers instead.
2. **Switch panes with an inline `style={{ display }}`,** not a class and not Radix's `hidden`
   attribute. Sandpack's CSS-in-JS sets `display` on those subtrees and wins otherwise. Both panes
   stay mounted deliberately — unmounting tears down and reboots the preview iframe.
3. **The provider wrapper is a flex container,** so the panel's root needs `min-w-0 flex-1` or the
   preview renders in a narrow strip with dead space beside it.

Theming goes through `src/lib/sandpack-theme.ts`, which is the `globals.css` dark tokens resolved
to hex. Sandpack does colour maths on some values, so hand it literals, not `var(--brand)`.
