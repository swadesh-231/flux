import {
  Code2,
  Cpu,
  Eye,
  ImageIcon,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export const SUGGESTIONS = [
  {
    label: "SaaS landing page",
    prompt:
      "A landing page for a developer tool: hero, feature grid, pricing table, and footer.",
  },
  {
    label: "Analytics dashboard",
    prompt:
      "An analytics dashboard with a revenue chart, a row of stat tiles, and a sortable table.",
  },
  {
    label: "Realtime chat",
    prompt:
      "A chat app with rooms, message history, and typing indicators.",
  },
  {
    label: "Booking platform",
    prompt:
      "A booking flow with a listing grid, a calendar picker, and a checkout step.",
  },
  {
    label: "Notes app",
    prompt:
      "A notes app with a sidebar of documents, markdown editing, and full-text search.",
  },
] as const;

export const PLACEHOLDERS = [
  "A dashboard for tracking freelance invoices…",
  "A CRM with a kanban pipeline and notes…",
  "A chat app with rooms and typing indicators…",
  "An issue tracker with keyboard shortcuts…",
  "A booking flow with a calendar and payments…",
  "A portfolio with a case-study template…",
] as const;

export const OUTPUT_STACK = [
  "React",
  "TypeScript",
  "Tailwind CSS",
  "shadcn/ui",
] as const;

type Feature = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly desc: string;
};

export const FEATURES: readonly Feature[] = [
  {
    icon: Wand2,
    label: "Prompt to project",
    desc: "Describe the app in a sentence. Flux decides the routes, the components, and the state that holds them together, then writes it.",
  },
  {
    icon: Eye,
    label: "Preview as it builds",
    desc: "The app renders while the agent is still working. No install step, no dev server, nothing to wait for.",
  },
  {
    icon: Code2,
    label: "Code you would have written",
    desc: "Typed React and Tailwind, split into files you can actually read — then edit by hand, or keep asking.",
  },
  {
    icon: Cpu,
    label: "Dependencies that resolve",
    desc: "Packages are checked against the registry and installed before the import lands, so you never inherit a library that does not exist.",
  },
  {
    icon: Sparkles,
    label: "Reads its own errors",
    desc: "A runtime failure goes back to the agent with its stack trace. You get an explanation in plain language and a patch.",
  },
  {
    icon: ImageIcon,
    label: "Build from an image",
    desc: "Hand it a screenshot, an export, or a photo of a whiteboard, and get an interface that matches the layout.",
  },
];

type Step = {
  readonly number: string;
  readonly label: string;
  readonly desc: string;
};

export const STEPS: readonly Step[] = [
  {
    number: "01",
    label: "Describe it",
    desc: "A sentence, a spec, or a screenshot. Whatever you already have is enough to start.",
  },
  {
    number: "02",
    label: "Watch it build",
    desc: "Flux scaffolds routing, components, styling, and data — and says what it is doing at each step.",
  },
  {
    number: "03",
    label: "Refine by chat",
    desc: "Ask for changes the way you would ask a colleague. Every edit is scoped, explained, and reversible.",
  },
  {
    number: "04",
    label: "Take it with you",
    desc: "Export the repository or deploy straight to production. It is ordinary source code, and it is yours.",
  },
];
