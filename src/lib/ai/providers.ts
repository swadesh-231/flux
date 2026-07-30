import "server-only";

/**
 * The generation providers, in preference order.
 *
 * Any one of these can go down — Gemini in particular returns 503 UNAVAILABLE
 * for hours at a stretch under load — so a build walks the list until one
 * answers. Reorder this array to change which is tried first; everything else
 * (both API routes, the Cline agent) reads it.
 *
 * A provider with no key configured is skipped rather than failing the run, so
 * dropping `GROQ_API_KEY` from the environment degrades to a two-provider
 * chain instead of erroring.
 */
export interface AiProvider {
  /** Stable id used in logs and status events. */
  id: "gemini" | "openai" | "groq";
  /** Shown to the user when a fallback happens. */
  label: string;
  /** Model used for one-shot app generation. */
  model: string;
  /** Reads the key at call time — never captured at module load. */
  apiKey: () => string | undefined;
  /** OpenAI-compatible endpoint. Absent for Gemini, which has its own SDK. */
  baseUrl?: string;
  /** Whether the model accepts image input alongside text. */
  supportsImages: boolean;
  /** Matching provider id in `@cline/llms`, for the /api/improve agent. */
  clineProviderId: string;
}

export const AI_PROVIDERS: readonly AiProvider[] = [
  {
    id: "gemini",
    label: "Gemini",
    model: "gemini-3.5-flash",
    apiKey: () => process.env.GEMINI_API_KEY,
    supportsImages: true,
    clineProviderId: "gemini",
  },
  {
    id: "openai",
    label: "OpenAI",
    model: "gpt-4.1-mini",
    apiKey: () => process.env.OPEN_AI_API_KEY,
    baseUrl: "https://api.openai.com/v1",
    supportsImages: true,
    clineProviderId: "openai-native",
  },
  {
    id: "groq",
    label: "Groq",
    // gpt-oss-120b is the strongest coder in Groq's catalogue and holds JSON
    // mode reliably. It is text-only — attached images are described instead.
    model: "openai/gpt-oss-120b",
    apiKey: () => process.env.GROQ_API_KEY,
    baseUrl: "https://api.groq.com/openai/v1",
    supportsImages: false,
    clineProviderId: "groq",
  },
];

/** Providers that actually have a key set, in preference order. */
export function configuredProviders(): AiProvider[] {
  return AI_PROVIDERS.filter((provider) => Boolean(provider.apiKey()));
}

/**
 * Fallback models within Gemini itself, tried before moving to OpenAI.
 * A busy `gemini-3.5-flash` is usually joined by a healthy sibling.
 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
] as const;
