import "server-only";

import {
  ApiError,
  GoogleGenAI,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai";

import { GEMINI_MODELS } from "./constants";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type GeminiStream = AsyncGenerator<GenerateContentResponse>;

/**
 * Raised when every model in `GEMINI_MODELS` is refusing work. Distinct from a
 * bug in our own code, so callers can tell the user to retry rather than
 * showing a generic failure.
 */
export class AllModelsUnavailableError extends Error {
  constructor(detail?: string) {
    super(
      "Every Gemini model is busy right now. This is upstream capacity, not your prompt — please try again in a moment." +
        (detail ? ` (last upstream error: ${detail})` : ""),
    );
    this.name = "AllModelsUnavailableError";
  }
}

/**
 * Upstream capacity problems rather than anything wrong with the request:
 * 503 UNAVAILABLE (model overloaded), 429 RESOURCE_EXHAUSTED (quota), and 500
 * (Gemini returns these transiently under load). Retrying or switching model
 * is worth trying; a 400 is not.
 */
function isTransient(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 503 || error.status === 429 || error.status === 500)
  );
}

/**
 * The same judgement as `isTransient`, but from a message string.
 *
 * The Cline SDK surfaces provider failures through its own LLM layer, so the
 * original `ApiError` instance does not survive — all that reaches us is text.
 */
export function isTransientLlmMessage(text: string): boolean {
  return /\b(503|500|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|try again later/i.test(
    text,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Opens a streaming generation, trying each model in `GEMINI_MODELS` in turn
 * and retrying transient failures with a short backoff.
 *
 * Only the *opening* of the stream is retried. Once chunks are flowing the
 * caller has already emitted status events to the browser, and replaying from
 * a different model mid-response would corrupt the accumulated JSON.
 *
 * `onFallback` fires when a model is given up on, so the route can tell the
 * user why it is taking longer than usual.
 */
export async function generateWithFallback({
  contents,
  config,
  attemptsPerModel = 2,
  onFallback,
}: {
  contents: unknown;
  config: GenerateContentConfig;
  attemptsPerModel?: number;
  onFallback?: (info: { model: string; nextModel: string | null }) => void;
}): Promise<{ stream: GeminiStream; model: string }> {
  let lastTransient: unknown;

  for (const [index, model] of GEMINI_MODELS.entries()) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      try {
        const stream = await ai.models.generateContentStream({
          model,
          // The SDK's `contents` union is wider than what we build here.
          contents: contents as never,
          config,
        });
        return { stream, model };
      } catch (error) {
        if (!isTransient(error)) throw error;

        lastTransient = error;
        console.warn(
          `[gemini] ${model} unavailable (attempt ${attempt}/${attemptsPerModel})`,
        );

        if (attempt < attemptsPerModel) await sleep(600 * attempt);
      }
    }

    onFallback?.({ model, nextModel: GEMINI_MODELS[index + 1] ?? null });
  }

  console.error("[gemini] all models unavailable; last error:", lastTransient);
  throw new AllModelsUnavailableError();
}
