
export const SITE = {
  name: "Flux",
  tagline: "Agentic app builder",
  description:
    "Describe an app in a sentence. Flux plans it, writes the code, and renders a live preview in the browser — then hands you the source.",
  author: "Swadesh",
} as const;

/**
 * Marketing nav. Rooted at `/` rather than bare fragments, so they still work
 * from the auth pages — a bare `#pricing` on `/sign-in` scrolls nowhere.
 */
export const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#workflow", label: "Workflow" },
  { href: "/#pricing", label: "Pricing" },
] as const;

/**
 * The signed-in app's own nav. Rendered beside the logo by `AppHeader`, never
 * in the centre track — the middle of an app bar reads as marketing chrome.
 */
export const APP_NAV_LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/billing", label: "Billing" },
] as const;

/** Credits burned by one `/api/code-gen` or `/api/improve` run. */
export const GENERATION_COST = 1;

/** Below this the composer is disabled and the upgrade prompt takes over. */
export const MIN_GENERATIONS_REQUIRED = 1;

/**
 * Attached images are inlined as `data:` URLs — into the prompt, and into the
 * `messages` JSON column. 4 MB of source file is roughly 5.3 MB base64, which
 * is comfortable for both.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type PlanDefinition = {
  readonly label: string;
  readonly description: string;
  readonly price: number;
  readonly generations: number;
  readonly clerkPlanId: string | null;
  readonly featured: boolean;
  readonly active: boolean;
  readonly perks: readonly string[];
};

export const PLANS = {
  free: {
    label: "Free",
    description: "Enough room to find out whether this works for you.",
    price: 0,
    generations: 10,
    clerkPlanId: null,
    featured: false,
    active: true,
    perks: [
      "Live in-browser preview",
      "React, TypeScript, and Tailwind output",
      "Export the full source",
      "Community support",
    ],
  },
  starter: {
    label: "Starter",
    description: "For the side project that turned serious.",
    price: 20,
    generations: 50,
    clerkPlanId: "cplan_3HDhkYM01GaCFW70b8wgpSvPO87",
    featured: true,
    active: true,
    perks: [
      "Build from screenshots and mockups",
      "Priority generation queue",
      "Unlimited projects",
      "Email support",
    ],
  },
  pro: {
    label: "Pro",
    description: "For people who ship every day.",
    price: 50,
    generations: 100,
    clerkPlanId: "cplan_3HDi3EyjYxvr4idgu8IsGywMVUv",
    featured: false,
    active: true,
    perks: [
      "Everything in Starter",
      "The strongest coding agent",
      "Unlimited image prompts",
      "Early access to new models",
      "Premium support",
    ],
  },
} as const satisfies Record<string, PlanDefinition>;

export type PlanKey = keyof typeof PLANS;

export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];

export const DEFAULT_PLAN_KEY = "free" satisfies PlanKey;

export const PLAN_LIST: readonly (PlanDefinition & { readonly key: PlanKey })[] =
  PLAN_KEYS.map((key) => ({ key, ...PLANS[key] }));

export const planRank = (key: PlanKey) => PLAN_KEYS.indexOf(key);

/** `User.plan` is a plain string column, so narrow it before indexing `PLANS`. */
export const isPlanKey = (value: string): value is PlanKey =>
  Object.prototype.hasOwnProperty.call(PLANS, value);

/** Monthly credit allowance for a plan. Unknown values fall back to free. */
export const planCredits = (value: string): number =>
  PLANS[isPlanKey(value) ? value : DEFAULT_PLAN_KEY].generations;

export const planFeatures = (plan: PlanDefinition) => [
  `${plan.generations.toLocaleString("en-US")} generations per month`,
  ...plan.perks,
];

export function resolveActivePlanKey(
  hasPlan: (key: PlanKey) => boolean,
): PlanKey {
  for (let i = PLAN_KEYS.length - 1; i >= 0; i--) {
    const key = PLAN_KEYS[i];
    if (PLANS[key].clerkPlanId !== null && hasPlan(key)) return key;
  }

  return DEFAULT_PLAN_KEY;
}
