import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import {
  configuredProviders,
  GEMINI_FALLBACK_MODELS,
  type AiProvider,
} from "./providers";

// ─── Neutral request shape ────────────────────────────────────────────────────

export interface PromptImage {
  mimeType: string;
  /** Base64 payload, no `data:` prefix. */
  data: string;
}

export interface PromptMessage {
  role: "user" | "assistant";
  text: string;
  image?: PromptImage;
}

/** One piece of a streamed response. `thought` chunks are reasoning, not output. */
export interface GenerationChunk {
  kind: "thought" | "output";
  text: string;
}

export interface GenerationRequest {
  system: string;
  messages: PromptMessage[];
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class AllProvidersUnavailableError extends Error {
  constructor(detail?: string) {
    super(
      "Every model provider is busy or unreachable right now. This is upstream capacity, not your prompt — please try again in a moment." +
        (detail ? ` (last error: ${detail})` : ""),
    );
    this.name = "AllProvidersUnavailableError";
  }
}

/**
 * Upstream capacity rather than a bad request: overloaded, rate limited, or a
 * transient 5xx. Worth retrying or switching provider; a 400 or a 401 is not.
 */
function isTransient(error: unknown): boolean {
  const status =
    error instanceof ApiError
      ? error.status
      : error instanceof OpenAI.APIError
        ? error.status
        : undefined;

  if (status === 429 || status === 500 || status === 502 || status === 503) {
    return true;
  }

  // Network-level failures (DNS, socket resets) surface as plain Errors.
  return error instanceof OpenAI.APIConnectionError;
}

/** Same judgement from a bare message — the Cline SDK loses the error instance. */
export function isTransientLlmMessage(text: string): boolean {
  return /\b(503|502|500|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|rate limit|try again later/i.test(
    text,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Gemini adapter ───────────────────────────────────────────────────────────

async function* geminiStream(
  apiKey: string,
  model: string,
  request: GenerationRequest,
): AsyncGenerator<GenerationChunk> {
  const ai = new GoogleGenAI({ apiKey });

  const contents = request.messages.map((message) => {
    const role = message.role === "assistant" ? "model" : "user";
    const parts: object[] = [];
    if (message.image) parts.push({ inlineData: message.image });
    parts.push({ text: message.text });
    return { role, parts };
  });

  const stream = await ai.models.generateContentStream({
    model,
    contents: contents as never,
    config: {
      systemInstruction: request.system,
      temperature: 0.7,
      responseMimeType: "application/json",
      thinkingConfig: { includeThoughts: true },
    },
  });

  for await (const chunk of stream) {
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (!part.text) continue;
      yield { kind: part.thought ? "thought" : "output", text: part.text };
    }
  }
}

// ─── OpenAI-compatible adapter (OpenAI + Groq) ────────────────────────────────

async function* openAiCompatibleStream(
  provider: AiProvider,
  apiKey: string,
  request: GenerationRequest,
): AsyncGenerator<GenerationChunk> {
  const client = new OpenAI({ apiKey, baseURL: provider.baseUrl });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: request.system },
    ...request.messages.map((message): OpenAI.Chat.ChatCompletionMessageParam => {
      if (message.role === "assistant") {
        return { role: "assistant", content: message.text };
      }

      if (message.image && provider.supportsImages) {
        return {
          role: "user",
          content: [
            { type: "text", text: message.text },
            {
              type: "image_url",
              image_url: {
                url: `data:${message.image.mimeType};base64,${message.image.data}`,
              },
            },
          ],
        };
      }

      // Text-only provider: say the image exists so the model doesn't claim to
      // have seen it, rather than silently dropping the user's reference.
      return {
        role: "user",
        content: message.image
          ? `[The user attached a reference image, which this model cannot view. Ask them to describe it if the layout depends on it.]\n\n${message.text}`
          : message.text,
      };
    }),
  ];

  const stream = await client.chat.completions.create({
    model: provider.model,
    messages,
    temperature: 0.7,
    // Both OpenAI and Groq honour JSON mode, which is what keeps the response
    // parseable without stripping markdown fences.
    response_format: { type: "json_object" },
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield { kind: "output", text };
  }
}

// ─── Fallback walker ──────────────────────────────────────────────────────────

export interface GenerationEvents {
  /** Fires once per attempt, with whatever is about to be tried. */
  onAttempt?: (info: { provider: AiProvider; model: string }) => void;
  /** Fires when a provider is given up on entirely. */
  onFallback?: (info: { from: string; to: string | null }) => void;
}

/**
 * Streams a generation, walking the provider chain until one succeeds.
 *
 * The fallback boundary is **the first output chunk**, not the opening of the
 * stream. Gemini in particular accepts the request, starts streaming, and only
 * then returns 503 — so treating "opened successfully" as healthy lets a dead
 * provider through. Until output text has been yielded, nothing is committed
 * downstream (status labels are cosmetic), so switching is safe. After that
 * point an error has to propagate: resuming elsewhere would splice two
 * different JSON documents together.
 */
export async function* streamGeneration(
  request: GenerationRequest,
  events: GenerationEvents = {},
): AsyncGenerator<GenerationChunk> {
  const providers = configuredProviders();

  if (providers.length === 0) {
    throw new Error(
      "No AI provider is configured. Set GEMINI_API_KEY, OPEN_AI_API_KEY, or GROQ_API_KEY.",
    );
  }

  let lastError: unknown;

  for (const [index, provider] of providers.entries()) {
    const apiKey = provider.apiKey()!;

    // Gemini's sibling models are tried before leaving the provider — a busy
    // gemini-3.5-flash usually has a healthy relative.
    const models =
      provider.id === "gemini" ? [...GEMINI_FALLBACK_MODELS] : [provider.model];

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        let producedOutput = false;

        try {
          events.onAttempt?.({ provider, model });

          const source =
            provider.id === "gemini"
              ? geminiStream(apiKey, model, request)
              : openAiCompatibleStream(provider, apiKey, request);

          for await (const chunk of source) {
            if (chunk.kind === "output") producedOutput = true;
            yield chunk;
          }

          return; // ran to completion
        } catch (error) {
          if (producedOutput || !isTransient(error)) throw error;

          lastError = error;
          console.warn(
            `[ai] ${provider.id}/${model} unavailable (attempt ${attempt}/2)`,
          );
          if (attempt < 2) await sleep(500 * attempt);
        }
      }
    }

    events.onFallback?.({
      from: provider.label,
      to: providers[index + 1]?.label ?? null,
    });
  }

  console.error("[ai] all providers unavailable; last error:", lastError);
  throw new AllProvidersUnavailableError(
    lastError instanceof Error ? lastError.message.slice(0, 120) : undefined,
  );
}
