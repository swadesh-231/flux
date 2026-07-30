import "server-only";

/**
 * The three generation providers.
 *
 * Which one leads depends on the job — see `PROVIDER_ROLES`. Any of them can be
 * down for hours at a stretch (Gemini returns 503 UNAVAILABLE under load), so
 * every job falls through the rest of the list rather than failing outright.
 *
 * A provider with no key configured is skipped, so removing a key degrades the
 * chain instead of breaking the app.
 */
export interface AiProvider {
  /** Stable id used in logs and status events. */
  id: "gemini" | "openai" | "groq";
  /** Shown to the user when a fallback happens. */
  label: string;
  /** Model used for app generation. */
  model: string;
  /** Reads the key at call time — never captured at module load. */
  apiKey: () => string | undefined;
  /** OpenAI-compatible endpoint. Absent for Gemini, which has its own SDK. */
  baseUrl?: string;
  /** Whether the model accepts image input alongside text. */
  supportsImages: boolean;
  /** Ceiling on response length. Too low truncates mid-JSON. */
  maxOutputTokens: number;
  /** Matching provider id in `@cline/llms`, for the /api/improve agent. */
  clineProviderId: string;
}

const PROVIDERS: Record<AiProvider["id"], AiProvider> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    model: "gpt-4.1-mini",
    apiKey: () => process.env.OPEN_AI_API_KEY,
    baseUrl: "https://api.openai.com/v1",
    supportsImages: true,
    maxOutputTokens: 16384,
    clineProviderId: "openai-native",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    model: "gemini-3.5-flash",
    apiKey: () => process.env.GEMINI_API_KEY,
    supportsImages: true,
    maxOutputTokens: 32768,
    clineProviderId: "gemini",
  },
  groq: {
    id: "groq",
    label: "Groq",
    // gpt-oss-120b is the strongest coder in Groq's catalogue and holds JSON
    // mode reliably. It is text-only — attached images are described instead.
    model: "openai/gpt-oss-120b",
    apiKey: () => process.env.GROQ_API_KEY,
    baseUrl: "https://api.groq.com/openai/v1",
    supportsImages: false,
    maxOutputTokens: 16384,
    clineProviderId: "groq",
  },
};

/**
 * What a request is for. The two jobs want different strengths, so each leads
 * with a different provider and keeps the others as fallback:
 *
 * - `build` — writing a whole app from a description. OpenAI leads; it is the
 *   most reliable at returning one large, well-formed JSON document.
 * - `fix` — repairing a broken preview or applying an improvement. Gemini
 *   leads (its reasoning output drives the status list), with Groq behind it
 *   for speed.
 */
export type ProviderRole = "build" | "fix";

const PROVIDER_ROLES: Record<ProviderRole, AiProvider["id"][]> = {
  build: ["openai", "gemini", "groq"],
  fix: ["gemini", "groq", "openai"],
};

/** Providers for a job, in preference order, skipping any without a key. */
export function providersForRole(role: ProviderRole): AiProvider[] {
  return PROVIDER_ROLES[role]
    .map((id) => PROVIDERS[id])
    .filter((provider) => Boolean(provider.apiKey()));
}

/** Every configured provider, in build order. Used for logging and diagnostics. */
export function configuredProviders(): AiProvider[] {
  return providersForRole("build");
}

/**
 * Fallback models within Gemini itself, tried before moving to the next
 * provider — a busy `gemini-3.5-flash` usually has a healthy sibling.
 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const;
