<div align="center">

# Flux

**Agentic app builder.** Describe an app in a sentence — Flux plans it, writes the code,
renders a live preview in the browser, and hands you the source.

Next.js 16 · React 19 · Prisma 7 · Clerk 7 · Sandpack · Tailwind v4

</div>

---

## Table of contents

- [What it does](#what-it-does)
- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Architecture](#architecture)
  - [Routing and page chrome](#routing-and-page-chrome)
  - [Auth and billing](#auth-and-billing)
  - [Data model](#data-model)
  - [The AI layer](#the-ai-layer)
  - [Generation endpoints](#generation-endpoints)
  - [The preview sandbox](#the-preview-sandbox)
  - [Abuse protection](#abuse-protection)
- [Project structure](#project-structure)
- [Styling system](#styling-system)
- [Deployment](#deployment)
- [Gotchas](#gotchas)

---

## What it does

1. A visitor types a prompt on the landing page (optionally attaching a screenshot or mockup).
2. They sign in, name the project, and land in `/workspace`.
3. `POST /api/code-gen` streams the build over SSE — status frames, live reasoning labels, then a
   finished JSON document describing every file and dependency.
4. The result renders instantly in a Sandpack preview; the code pane shows the source, and the whole
   project can be downloaded as a zip.
5. Follow-up prompts refine the app. A broken preview gets a **Fix it** button on the error banner.
   Pro users get **Improve**, which runs a real agent loop that edits files in place.

Every generation costs one credit. Credits come from the plan.

| Plan | Price | Generations / month | Notes |
| --- | --- | --- | --- |
| Free | $0 | 10 | Live preview, source export |
| Starter | $20 | 50 | Image prompts, priority queue |
| Pro | $50 | 100 | Unlocks the `/api/improve` agent |

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Auth + subscriptions | Clerk 7 (`@clerk/nextjs`, `@clerk/ui`) |
| Database | Postgres (Neon) via Prisma 7 + `@prisma/adapter-pg` |
| AI | OpenAI, Google Gemini, Groq — plus `@cline/sdk` for the agent loop |
| Preview sandbox | `@codesandbox/sandpack-react` |
| Styling | Tailwind v4 (CSS-first), shadcn `radix-sera` style, `@animate-ui` |
| Edge protection | Arcjet (shield, bot detection, token bucket, prompt-injection) |
| Package manager | **bun** |

There is no test setup in this repo.

---

## Getting started

**Prerequisites:** [Bun](https://bun.sh), a Postgres database (Neon works out of the box), and
accounts for Clerk, Arcjet, and at least OpenAI.

```bash
git clone https://github.com/swadesh-231/flux.git
cd flux
bun install                       # postinstall runs `prisma generate`
touch .env                        # fill it in — see Environment variables below
bun --bun run prisma migrate deploy
bun dev                           # http://localhost:3000
```

> **`bun --bun run prisma …` is the required form.** `prisma.config.ts` was generated on that
> assumption and reads `DATABASE_URL` through `env()` at that point — plain `bunx prisma` will not
> pick the datasource url up.

The Prisma client is generated into `src/generated/prisma`, which is **gitignored**. After every
`git pull` that touches the schema, re-run `bun --bun run prisma generate`.

### Clerk setup

1. Create an application; copy the publishable and secret keys.
2. Configure the two paid plans in **Billing → Plans**. Copy each plan's `cplan_…` id into
   `clerkPlanId` in `src/lib/constants.ts`, and make sure each plan's **slug** matches the
   corresponding key in `PLANS` (`starter`, `pro`) — checkout uses the id, detection uses the slug,
   and they are not interchangeable.
3. Set each plan's feature text to the same generation count as `PLANS[*].generations`. `/billing`
   renders Clerk's own `<PricingTable/>`, so that text is what users actually read.

---

## Environment variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# FALLBACK, not FORCE — a deep link opened while signed out still returns you there afterwards.
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/projects
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/projects

# Database
DATABASE_URL=postgresql://...

# Abuse protection
ARCJET_KEY=ajkey_...

# Model providers
OPEN_AI_API_KEY=sk-...      # note the underscore in OPEN_AI — required for builds
GEMINI_API_KEY=...          # fixes and improvements
GROQ_API_KEY=...            # fix fallback
```

Keys are read **at call time**, never captured at module load, so a provider with no key is simply
skipped rather than crashing the app. The consequence is per-role: a machine with only
`GEMINI_API_KEY` set can repair a preview but cannot build a new app.

---

## Commands

```bash
bun dev                              # dev server on :3000
bun run build                        # production build
bun run lint                         # eslint (flat config, eslint-config-next 16)
npx tsc --noEmit                     # typecheck (tsconfig is noEmit-only)

bun --bun run prisma generate        # regenerate the client into src/generated/prisma
bun --bun run prisma migrate dev     # create + apply a migration
bun --bun run prisma migrate deploy  # apply prisma/migrations to DATABASE_URL
```

---

## Architecture

### Routing and page chrome

`src/app/layout.tsx` is **providers only** — Clerk, theme, `Toaster`. Page chrome belongs to the
route groups, because the three surfaces want different shells:

| Group | Chrome | Contents |
| --- | --- | --- |
| `(marketing)/` | `Header` + `<main className="pt-22">` + `Footer` | the landing page |
| `(auth)/` | `Header` + centred column | Clerk `<SignIn>` / `<SignUp>` catch-alls |
| `(main)/` | `AppHeader`, no footer | `/workspace`, `/projects`, `/billing` |

`(main)/layout.tsx` calls `auth.protect()` and then `checkUser()`, so everything underneath can
assume a local `User` row exists — and it passes that row's `credits`/`plan` straight into the
header. **Adding a route means picking a group;** a file dropped into `src/app/` directly gets no
header at all.

Signing in or up lands on **`/projects`**, which is the app's home: a stats strip over
`getUserProjects()` plus `ProjectGallery`, which filters client-side over the already-loaded set.

**Two headers, one shell.** `Header` is the marketing bar (anchors centred, Clerk auth actions
right). `AppHeader` is the signed-in bar (nav *beside the logo*, credits pill + New project + avatar
right, centre deliberately empty). Both wrap `HeaderShell`, which isolates the scroll behaviour in a
single `"use client"` component and exposes it as `data-state="condensed|top"` on a `group/header` —
descendants animate by reacting to `group-data-[state=condensed]/header:…` rather than becoming
client components themselves.

`NAV_LINKS` are rooted (`/#pricing`, not `#pricing`) so they still resolve from `/sign-in`.

### Auth and billing

**Clerk owns subscription state.** `src/proxy.ts` (Next 16 renamed `middleware.ts`, and it runs on
the Node.js runtime) runs `clerkMiddleware()` **for Arcjet only**. Auth gating is resource-based —
`createRouteMatcher` is deprecated in Clerk 7 because path matching can drift from how Next.js
actually routes a request:

- `auth.protect()` in `(main)/layout.tsx`
- an `auth()` check inside every server action and route handler

Do not reintroduce path-matching auth in the proxy.

`User.plan` and `User.credits` mirror Clerk onto the database. `src/lib/checkUser.ts` reconciles them
on every authenticated page view: it creates the row on first sight, and on a plan change tops
credits up **by the delta, upgrades only** — a downgrade keeps whatever is left rather than clawing
credits back mid-cycle. The top-up is idempotent because the `updateMany` is guarded on the *old*
plan, so concurrent requests grant it once.

> **`checkUser` is wrapped in React `cache()`, and that is load-bearing.** A layout and the page
> beneath it render *in parallel*, so `(main)/layout.tsx` and a page's own lookup both reach it on a
> first visit. Uncached, both read "no row", both `create()`, and one dies on the `clerkId` unique
> constraint. The `create` additionally catches P2002 and re-reads, covering the same race across two
> separate requests. Any new "fetch the current user" helper should call `checkUser()` on the miss
> path rather than redirecting.

`src/lib/constants.ts` is the seam between the UI and the Clerk dashboard. Three things have to agree
on the per-plan generation count and **nothing enforces it automatically**: `PLANS[*].generations`,
the feature text on the plan in Clerk, and — for the free tier — `User.credits`'s `@default` in the
schema. Changing one means changing all three, plus a migration for the default. (Prisma applies
scalar `@default`s **client-side**, so a default change needs `prisma generate`, not just
`migrate deploy`.)

`PLANS` keys are **declared in tier order**, and both pricing surfaces derive upgrade/downgrade
direction from that key order via `planRank` — reordering the object changes behaviour.

### Data model

```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  name      String
  email     String   @unique
  imageUrl  String   @default("")
  credits   Int      @default(10)
  plan      String   @default("free")
  workspaces Workspace[]
}

model Workspace {
  id       String  @id @default(cuid())
  title    String?
  userId   String
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Json    @default("[]")   // Message[]
  fileData Json?                    // FileData
  @@index([userId])
}
```

A **Workspace is a project**: the transcript and the generated file tree live in two `Json` columns.
`src/types/workspace.ts` is the contract those columns are expected to hold — anything read back out
is validated by the `parse*` helpers in `WorkspaceClient` before it is trusted.

Prisma 7 uses the new `prisma-client` generator with `output = "../src/generated/prisma"`, so the
client is imported as `@/generated/prisma/client` — **not** from `@prisma/client`. The connection URL
lives in `prisma.config.ts`, not in the schema.

### The AI layer

`src/lib/ai/` defines three providers and **two exclusive chains**. Every job walks its chain until
one answers, skipping providers with no key set — and neither job ever falls into the other's
providers.

| Role | Chain | Used by |
| --- | --- | --- |
| `build` | **OpenAI only** (`gpt-4.1-mini`) | writing a whole app |
| `fix` | **Gemini → Groq** (`gemini-3.5-flash`, `openai/gpt-oss-120b`) | the "Fix it" button, and `/api/improve` |

The trade is deliberate: OpenAI is by far the most reliable at returning one large, well-formed JSON
document, and a whole app is exactly the response a weaker model truncates. So an OpenAI outage stops
new builds outright rather than silently handing back a weaker app that still cost a credit — while
fixes keep working throughout, because they never touch OpenAI. Widening `PROVIDER_ROLES` is the only
change needed to reinstate cross-role fallback; nothing else reads provider order.

Because the chains differ per job, "nothing configured" is per-role too: `MissingProviderError` names
just the keys that role needs, and `AllProvidersUnavailableError` names the providers actually tried
rather than claiming all three are down.

Within Gemini, sibling models (`gemini-3.5-flash` → `gemini-3-flash-preview` → `gemini-2.5-flash`)
are tried before leaving the provider — a busy model usually has a healthy relative. Each model gets
two attempts with a short backoff.

**`generateJson` buffers rather than streams the result, and that is deliberate.** The response is
only usable if it parses, so a provider returning a truncated or shapeless document is treated
exactly like one returning 503 — logged, then retried on the next model, then the next provider.
Streaming raw text to the caller would commit the run to whichever provider emitted the first byte,
which is how one bad response used to fail an entire build. Reasoning still arrives live through
`onThought`, because status labels cost nothing if the attempt is later abandoned.

Truncation is detected **explicitly** (`finishReason: MAX_TOKENS` / `finish_reason: "length"`) and
each provider carries its own `maxOutputTokens`, because silently running out of budget mid-document
is the most common cause of unparseable output.

Adapters normalise everything to `PromptMessage` (role + text + optional image). Gemini has its own
SDK; OpenAI and Groq share one OpenAI-compatible adapter differing only by `baseUrl` and model. Groq's
model is text-only, so `supportsImages: false` makes attachments degrade to a described note rather
than being silently dropped.

### Generation endpoints

Two streaming SSE endpoints, both `runtime = "nodejs"`, both `maxDuration = 300`, both charging
`GENERATION_COST` credits.

#### `POST /api/code-gen`

Returns the whole app as one JSON payload: `{ assistantMessage, title, files, dependencies }`. The
request's `intent` picks the chain (`build` by default, `fix` for the error-banner repair). Attached
images arrive as `data:` URLs and are forwarded as real image parts. Before saving, every returned
dependency is checked against the npm registry with a 1.5s timeout and dropped if it doesn't resolve —
a hallucinated package would otherwise wedge the bundler.

SSE frame types: `status`, `error`, `done`.

The serving provider is announced **once** as a `status` frame ("Building with OpenAI…" / "Repairing
with Gemini…") — the user's only visible evidence of the routing. Later providers in the chain are
announced by `onFallback` instead ("Switching to Groq…"), which conveys that a switch *happened*.

#### `POST /api/improve`

**Pro-only.** A `@cline/sdk` agent loop edits files in place through two tools: `update_file` (once
per file, always complete contents) and `done_improving` (`lifecycle.completesRun`). Each
`update_file` emits a `file_patch` frame so the client can show progress as edits land.

Transient provider failures fall through to the next provider **only while `hasAppliedWork` is
false** — once edits have landed, re-running from scratch would compound them. The client's `abort`
signal is wired to `agent.abort()`, and an aborted run charges nothing.

SSE frame types: `status`, `thinking`, `file_patch`, `error`, `done`.

#### Shared rules

- Both **verify workspace ownership before charging.**
- Both charge with a conditional `updateMany` (`credits: { gte: cost }`) rather than a plain
  decrement, so concurrent runs cannot drive a balance negative.
- Do not collapse a stream failure into a blanket "Something went wrong": upstream capacity is the
  most likely cause and the user can act on it by retrying. `describeStreamError` keeps known
  failures legible and spells out unrecognised ones outside production.
- On the client, SSE frames are parsed inside a `try`/`catch` but **handled outside it** — wrapping
  both lets the catch swallow the `error` event and end the stream in silence.

### The preview sandbox

`CodePanel` drives Sandpack. Four traps, all previously hit:

1. **Do not use `<SandpackLayout>`.** It sizes children through a `> .sp-stack` child selector, so
   the moment you wrap a pane in anything — a tab panel, a flex row — the panes lose their height and
   render stacked on top of each other. Lay `SandpackPreview` / `SandpackCodeEditor` out in your own
   flex containers instead.
2. **One pane at a time, Preview by default**, switched by the toolbar toggle; a finished build snaps
   back to Preview. Both panes stay mounted regardless — unmounting the preview reboots the iframe and
   loses the running app's state. Switch with an inline `style={{ display }}`, **not** a class and not
   the `hidden` attribute, because Sandpack's CSS-in-JS sets `display` on those subtrees and wins.
3. **The provider wrapper is a flex container,** so the panel's root needs `min-w-0 flex-1` or the
   preview renders in a narrow strip with dead space beside it. While dragging the divider, an overlay
   has to cover the preview or the iframe eats the mouse events.
4. **Remounting `SandpackProvider` is expensive and unreliable — key it on the dependency set and
   nothing else.** A remount discards the bundler iframe and re-fetches it from
   `*-sandpack.codesandbox.io`, which 503s often enough to matter; the fetch has no retry, so the panel
   just sits on its loading overlay. (This was the "I have to refresh to see the output" bug: the key
   used to be the file *path set*, which almost always changes on the first generation.)

   Code changes need no remount — `useFiles` reacts to the `files` prop and `sandpack.updateFile`
   pushes into the live client. New *packages* do: dependencies reach the bundler as a generated
   `/package.json`, and an already-installed client will not install again.

   Two supporting rules. **Memoise `files` and `customSetup`** — `useFiles` watches them by identity,
   so inline objects made every render reset Sandpack's state constantly and re-arm the recompile
   debounce. And **`listen` is a plain function, not a `useCallback`**, so it is a fresh identity per
   render; keep it in a ref rather than an effect dependency, or the effect re-arms forever. The build
   watchdog in `SandpackInner` (20s timeout, up to 2 bundler re-fetches) depends on both.

A `BASE_DEPENDENCIES` set (router, lucide, recharts, framer-motion, zod, radix primitives, …) is
always installed, so generated apps can import them without the model having to declare them.
Theming goes through `src/lib/sandpack-theme.ts`, which is the `globals.css` dark tokens resolved to
hex — Sandpack does colour maths on some values, so hand it literals, not `var(--brand)`.

Export is a client-side `jszip` bundle of the current file tree.

### Abuse protection

Two Arcjet clients, deliberately different:

- **Global** (`src/proxy.ts`) — `shield` + `detectBot`, running on every request. Looser: search
  engines and link previews are allowed so the landing page gets indexed and Slack/Twitter unfurls
  work. A denied decision returns 403.
- **Route-level** (`src/lib/arcjet.ts`) — used by both generation endpoints. `tokenBucket` keyed on
  `userId` rather than IP so the bucket follows the account (5 tokens, refilled 5/minute: enough for a
  burst of edits, not enough to grind through a plan's credits by accident), plus
  `detectPromptInjection` over the raw user text. Callers must pass `{ userId }` and
  `{ detectPromptInjectionMessage }`.

---

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx                 # providers only — Clerk, theme, Toaster
│  ├─ globals.css                # the entire Tailwind v4 theme
│  ├─ (marketing)/               # landing page
│  ├─ (auth)/                    # Clerk sign-in / sign-up catch-alls
│  ├─ (main)/                    # signed-in app: auth.protect() + checkUser()
│  │  ├─ workspace/              # the builder
│  │  ├─ projects/               # app home — stats strip + gallery
│  │  └─ billing/                # Clerk <PricingTable/>
│  └─ api/
│     ├─ code-gen/route.ts       # SSE: whole-app generation
│     └─ improve/route.ts        # SSE: @cline/sdk agent loop (Pro)
├─ actions/                      # server actions (project, workspace)
├─ components/
│  ├─ ui/                        # shadcn primitives — regenerable, avoid hand-editing
│  ├─ animate-ui/                # @animate-ui registry output — keep separate
│  ├─ base/                      # Header, AppHeader, HeaderShell, Footer, nav
│  ├─ landing/                   # Hero, Features, Workflow, Pricing, ClosingCta
│  ├─ project/                   # the workspace surface (files match component names)
│  └─ reusables.tsx              # Section, Eyebrow, Accent, Display, SectionHeader
├─ lib/
│  ├─ ai/{providers,generate}.ts # roles, chains, adapters, fallback walker
│  ├─ constants.ts               # SITE, nav, PLANS — the seam with the Clerk dashboard
│  ├─ data.ts                    # landing-page copy — keep marketing out of components
│  ├─ checkUser.ts               # Clerk → User reconciliation, request-cached
│  ├─ prisma.ts, arcjet.ts, sandpack-theme.ts, utils.ts
├─ types/                        # ProjectSummary, Message, FileData, StatusStep
├─ proxy.ts                      # Next 16's renamed middleware — Arcjet + Clerk
└─ generated/prisma/             # gitignored; run `prisma generate`
```

---

## Styling system

**Tailwind v4, CSS-first.** There is no `tailwind.config.*` — the whole theme is `@theme inline` plus
`:root`/`.dark` oklch tokens in `src/app/globals.css`, loaded via `@tailwindcss/postcss`. Dark mode is
a class variant driven by `next-themes`; the default is dark.

**shadcn in `radix-sera` style with the `taupe` base colour.** This is not default shadcn — its
`Button`/`Badge` are `rounded-none`, uppercase, tracking-widest micro-type, and icons inside a Button
are positioned by a **data attribute, not a class**:

```tsx
<Button>Generate <ArrowRight data-icon="inline-end" aria-hidden /></Button>
```

The variants key off `has-data-[icon=inline-end]` to adjust padding, so dropping that attribute
silently breaks spacing. The landing page deliberately overrides the squared look with
`rounded-full`/`rounded-2xl` — follow whichever language the surrounding section already uses.

**One accent only — the brand gold in `--brand`.** Use the `Accent` primitive rather than re-inlining
the gradient classes, and don't introduce a second accent hue.

**Alignment.** `Section` holds its gutter **inside** the `max-w-6xl` track, not outside it, and that
is what aligns the page with the header: the header pane is also `max-w-6xl` and insets its nav by the
same `px-6`, so at full width the logo sits directly above the first character of every section.
Surfaces that can't use `Section` — the footer, `/projects`, `/billing` — align to that track by hand.
Section padding is *half* the gap you see, since two stacked sections each contribute one edge.

**Header offset.** The fixed header is cleared by `pt-22` on `<main>` in each route-group layout
(`pt-4` inset + `h-14` pane + gap). Changing the header's height or inset means updating every group,
plus the `h-[calc(100dvh-5.5rem)]` the workspace uses to fit both panels on one screen, and the
`-mt-22 pt-22` the hero uses to cancel the offset so its sky and starfield reach the top of the page.

Arbitrary animations (`animate-[shimmer_…]`, `animate-[blink_…]`) still need their `@keyframes`
declared in `globals.css` — Tailwind does not invent them from the class name.

---

## Deployment

Built for Vercel. Both generation routes set `maxDuration = 300`, which needs **Fluid compute**
enabled — a long build on a cold provider will otherwise be cut off mid-stream.

Checklist:

1. Set every variable from [Environment variables](#environment-variables) in the project settings.
2. `bun --bun run prisma migrate deploy` against the production `DATABASE_URL`.
3. Confirm the Clerk plan ids and slugs in `src/lib/constants.ts` match the **production** Clerk
   instance, not the dev one.
4. `next.config.ts` lists the `@cline/*` packages in `serverExternalPackages` — keep that when adding
   any Node-only dependency to the improve route.
5. The build runs `postinstall → prisma generate`, so `src/generated/prisma` is produced at deploy
   time and never committed.

---

## Gotchas

A short list of the things that have actually broken this codebase before.

- **This is Next.js 16.** Version-specific breaking changes matter here, and the authoritative docs
  ship inside the install at `node_modules/next/dist/docs/` (`01-app/` for the App Router). Consult
  them before writing code rather than relying on remembered Next.js conventions.
- **Nothing may generate into `<repo>/app`.** A root-level `app/` directory would be read as a second
  App Router and collide with `src/app` — which is why the Prisma output path is pinned and both
  `app/generated/prisma` and `src/generated/prisma` are gitignored.
- **Import Prisma from `@/generated/prisma/client`.** `@prisma/client` will not have your models.
- **`h-[calc(100dvh-5.5rem)]` in the workspace must stay a definite height — `flex-1` will not do.**
  `body` is `min-h-full`, so nothing above the workspace has a resolved height for a percentage or
  flex basis to size against; with `flex-1` the panel grows to fit the code editor and the whole page
  scrolls, pushing the composer off-screen. Separately, every flex child in that column needs an
  explicit `min-h-0` — the default `min-height: auto` makes the transcript refuse to shrink below its
  content. Both failure modes look like "the composer disappeared".
- **Don't put app destinations in the marketing header's centre track.** A signed-in visitor there
  gets one "Open app" button in the right cluster.
- **`OPEN_AI_API_KEY`,** not `OPENAI_API_KEY`. Note the underscore.
- **Attached images are inlined as `data:` URLs** — into the prompt *and* into the `messages` JSON
  column. `MAX_IMAGE_BYTES` (4 MB) is what keeps that comfortable for both.
