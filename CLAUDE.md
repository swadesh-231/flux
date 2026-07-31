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

- `(marketing)/` — the landing page. `Header` + `<main className="pt-22">` + Footer.
- `(auth)/` — Clerk's `<SignIn>` / `<SignUp>` catch-all routes. `Header` + centred column.
- `(main)/` — the signed-in app (`/workspace`, `/projects`, `/billing`). **`AppHeader`**, no Footer.
  Calls `auth.protect()` and then `checkUser()`, so everything underneath can assume a local `User`
  row — and passes that row's `credits`/`plan` straight into the header.

Adding a route means picking a group; dropping one into `src/app/` directly gets no header at all.

Signing in or up lands on **`/projects`** via `NEXT_PUBLIC_CLERK_SIGN_{IN,UP}_FALLBACK_REDIRECT_URL`.
FALLBACK, not FORCE — a deep link opened while signed out still returns you there afterwards. That
page is the app's home, not a list bolted onto the marketing site: a stats strip over `getUserProjects()`
plus `ProjectGallery`, which filters client-side over the already-loaded set.

**Two headers, one shell.** `Header` is the marketing bar (anchors centred, Clerk auth actions
right); `AppHeader` is the signed-in bar (nav *beside the logo*, credits pill + New project + avatar
right, centre deliberately empty). Both wrap `HeaderShell`, so they share its geometry and the
workspace's `h-[calc(100dvh-5.5rem)]` keeps working. Do not put app destinations in the marketing
header's centre track — a signed-in visitor there gets one "Open app" button in the right cluster.
`NAV_LINKS` are rooted (`/#pricing`, not `#pricing`) so they still resolve from `/sign-in`.

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

- `POST /api/code-gen` — returns the whole app as one JSON payload. Attached images arrive as
  `data:` URLs and are forwarded as real image parts.
- `POST /api/improve` — the `@cline/sdk` agent loop edits files in place through an `update_file`
  tool. Pro-only. `next.config.ts` lists the `@cline/*` packages in `serverExternalPackages`.

**Three providers, two chains — `src/lib/ai/`.** `providers.ts` defines the roles; every job walks
its chain until one answers, skipping providers with no key set. The chains are **exclusive, not
just ordered** — neither job ever falls into the other's providers:

- `build` — writing a whole app. **OpenAI only.** It is the most reliable at returning one large,
  well-formed JSON document, and a whole app is exactly the response a weaker model truncates.
- `fix` — repairing a broken preview (the "Fix it" button on the error banner) or applying an
  improvement. **Gemini, then Groq.** `/api/code-gen` picks the chain from the request's `intent`;
  `/api/improve` is always `fix`.

The trade is deliberate: an OpenAI outage stops new builds outright rather than silently handing
back a weaker app that still cost a credit, while fixes keep working because they never touch
OpenAI. Widening `PROVIDER_ROLES` is the only change needed to reinstate cross-role fallback —
nothing else reads provider order. Because the chains differ per job, "nothing configured" is
per-role too: `MissingProviderError` names just the keys that role needs, and
`AllProvidersUnavailableError` names the providers actually tried rather than claiming all three
are down. `/api/code-gen` announces the serving provider once as a `status` frame ("Building with
OpenAI…" / "Repairing with Gemini…"), which is the user's only visible evidence of the routing —
later providers are announced by `onFallback` instead, which conveys that a switch happened.

**`generateJson` buffers rather than streams the result, and that is deliberate.** The response is
only usable if it parses, so a provider returning a truncated or shapeless document is treated
exactly like one returning 503 — logged and retried on the next model, then the next provider.
Streaming raw text to the caller would commit the run to whichever provider emitted the first byte,
which is how one bad response used to fail the entire build with "AI returned invalid JSON".
Reasoning still arrives live through `onThought`, because status labels cost nothing if the attempt
is later abandoned.

Truncation is detected explicitly (`finishReason: MAX_TOKENS` / `finish_reason: "length"`) and each
provider carries its own `maxOutputTokens`, because silently running out of budget mid-document is
the most common cause of unparseable output.

Adapters normalise to `PromptMessage` (role + text + optional image). Gemini has its own SDK;
OpenAI and Groq share one OpenAI-compatible adapter differing only by `baseUrl` and model. Groq's
model is text-only, so `supportsImages: false` makes attachments degrade to a described note rather
than being silently dropped.

Do not collapse a stream failure into a blanket "Something went wrong": upstream capacity is the
most likely cause and the user can act on it by retrying. `describeStreamError` keeps known failures
legible, and spells out unrecognised ones outside production.

Both charge with a conditional `updateMany` (`credits: { gte: cost }`) rather than a plain
decrement, so concurrent runs cannot drive a balance negative, and both verify workspace ownership
*before* charging. On the client, SSE frames are parsed inside a `try`/`catch` but **handled outside
it** — wrapping both lets the catch swallow the `error` event and end the stream in silence.

**Env vars in use:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `DATABASE_URL`, `ARCJET_KEY`,
`GEMINI_API_KEY`, `OPEN_AI_API_KEY`, `GROQ_API_KEY` (note the underscore in `OPEN_AI`).

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
- `src/components/base/` — app chrome. `Header.tsx` and `AppHeader.tsx` are both server components;
  the scroll behaviour is isolated in the `"use client"` `HeaderShell.tsx`, which exposes state as
  `data-state="condensed|top"` on a `group/header`. Descendants animate by reacting to
  `group-data-[state=condensed]/header:…` rather than by becoming client components themselves —
  preserve that split when adding to the header. The one exception is `AppNav.tsx`, which needs
  `usePathname` for the current-page highlight; keep it that small.
- `src/components/reusables.tsx` — typography primitives: `Section`, `Eyebrow`, `Accent`, `Display`,
  `SectionHeader`. **One accent only — the brand gold in `--brand`.** `Accent` is the gold gradient
  phrase; use it instead of re-inlining the gradient classes, and don't introduce a second accent
  hue (an earlier pass had blue and violet scattered through the workspace).

  `Section` holds its gutter **inside** the `max-w-6xl` track (`SECTION_CONTAINER`), not outside it,
  and that is what aligns the page with the header: the header pane is also `max-w-6xl` and insets
  its nav by the same `px-6`, so at full width the logo sits directly above the first character of
  every section. Padding from the outside instead put the whole page 1.5rem left of the wordmark.
  Any surface that can't use `Section` — the footer, `/projects`, `/billing` — aligns to the same
  track by hand. Section padding is also *half* the gap you see, since two stacked sections each
  contribute one edge; `py-16 sm:py-24` is already 128/192px between bands.
- `src/components/project/` — the workspace surface. File names match their exported component.
- `src/lib/data.ts` — landing-page copy (features, steps, prompt placeholders, suggestions).
  Keep marketing content out of components.

The fixed header is cleared by `pt-22` on `<main>` in each route-group layout (`pt-4` inset + `h-14`
pane + gap); changing the header's height or inset means updating every group, plus the
`h-[calc(100dvh-5.5rem)]` the workspace uses to fit both panels on one screen — and the `-mt-22
pt-22` the hero uses to cancel that offset. The hero cancels it so its sky and starfield reach the
top of the page and sit *behind* the frosted pane; content lands in the same place either way.

**That `h-[calc(...)]` must stay a definite height — `flex-1` will not do.** `body` is `min-h-full`,
so nothing above the workspace has a resolved height for a percentage or flex basis to size
against; with `flex-1` the panel grows to fit the code editor and the whole page scrolls, pushing
the composer off-screen. Separately, every flex child in that column needs an explicit `min-h-0`:
the default `min-height: auto` makes the transcript refuse to shrink below its content, which
shoves the composer past the bottom edge. Both failure modes look like "the composer disappeared".

Arbitrary animations (`animate-[shimmer_…]`, `animate-[blink_…]`) still need their `@keyframes`
declared in `globals.css` — Tailwind does not invent them from the class name.

**Sandpack (`CodePanel`) has four traps, all previously hit:**

1. **Do not use `<SandpackLayout>`.** It sizes children through a `> .sp-stack` child selector, so
   the moment you wrap a pane in anything — a tab panel, a flex row — the panes lose their height
   and render stacked on top of each other. Lay `SandpackPreview` / `SandpackCodeEditor` out in
   your own flex containers instead.
2. **One pane at a time, Preview by default**, switched by the toolbar toggle; a finished build
   snaps back to Preview. Both panes stay mounted regardless — unmounting the preview reboots the
   Sandpack iframe and loses the running app's state. Switch with an inline `style={{ display }}`,
   not a class and not the `hidden` attribute, because Sandpack's CSS-in-JS sets `display` on
   those subtrees and wins otherwise. Build progress is a hairline above the pane plus a status
   line in the toolbar — deliberately *not* an overlay.
3. **The provider wrapper is a flex container,** so the panel's root needs `min-w-0 flex-1` or the
   preview renders in a narrow strip with dead space beside it. While dragging the divider, an
   overlay has to cover the preview or the iframe eats the mouse events.
4. **Remounting `SandpackProvider` is expensive and unreliable — key it on the dependency set and
   nothing else.** A remount discards the bundler iframe and re-fetches it from
   `*-sandpack.codesandbox.io`, which 503s often enough to matter; the fetch has no retry, so the
   panel just sits on its loading overlay and reloading the page is the only cure. This was the
   "I have to refresh to see the output" bug: the key was the file *path set*, which almost always
   changes on the first generation.

   Code changes need no remount — `useFiles` reacts to the `files` prop and `sandpack.updateFile`
   pushes into the live client. New *packages* do: dependencies reach the bundler as a generated
   `/package.json`, and an already-installed client will not install again.

   Two supporting rules. **Memoise `files` and `customSetup`** — `useFiles` watches them by
   identity, so inline objects made every render reset Sandpack's state constantly and re-arm the
   recompile debounce, cancelling the pending one each time. And **`listen` is a plain function,
   not a `useCallback`**, so it is a fresh identity per render; keep it in a ref rather than an
   effect dependency, or the effect re-arms forever. The build watchdog in `SandpackInner` depends
   on both of those being right.

Theming goes through `src/lib/sandpack-theme.ts`, which is the `globals.css` dark tokens resolved
to hex. Sandpack does colour maths on some values, so hand it literals, not `var(--brand)`.
