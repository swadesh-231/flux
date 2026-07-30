
export const SITE = {
  name: "Flux",
  tagline: "Agentic app builder",
  description:
    "Describe an app in a sentence. Flux plans it, writes the code, and renders a live preview in the browser — then hands you the source.",
  author: "Swadesh",
} as const;

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
] as const;

export const GENERATION_COST = 1;


export const MIN_GENERATIONS_REQUIRED = 1;

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
    generations: 20,
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
    price: 12,
    generations: 250,
    clerkPlanId: "cplan_3DvxGsOeYA5bpJzGWPi8o7wScRD",
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
    price: 29,
    generations: 1000,
    clerkPlanId: "cplan_3DvxTfywwB0NyQ1iqANclgNqlq8",
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
