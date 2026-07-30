import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import {
  GEMINI_FALLBACK_MODELS,
  providersForRole,
  type AiProvider,
  type ProviderRole,
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

/** The model ran out of output budget partway through the JSON document. */
export class TruncatedResponseError extends Error {
  constructor() {
    super("The model ran out of room before finishing the response.");
    this.name = "TruncatedResponseError";
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
  maxOutputTokens: number,
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
      maxOutputTokens,
      thinkingConfig: { includeThoughts: true },
    },
  });

  for await (const chunk of stream) {
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      if (!part.text) continue;
      yield { kind: part.thought ? "thought" : "output", text: part.text };
    }

    // Running out of room mid-document is the single most common cause of
    // unparseable output. Say so rather than letting JSON.parse fail blindly.
    if (chunk.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      throw new TruncatedResponseError();
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
    max_tokens: provider.maxOutputTokens,
    // Both OpenAI and Groq honour JSON mode, which is what keeps the response
    // parseable without stripping markdown fences.
    response_format: { type: "json_object" },
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield { kind: "output", text };

    if (chunk.choices[0]?.finish_reason === "length") {
      throw new TruncatedResponseError();
    }
  }
}

// ─── Fallback walker ──────────────────────────────────────────────────────────

export interface GenerationEvents {
  /** Fires once per attempt, with whatever is about to be tried. */
  onAttempt?: (info: { provider: AiProvider; model: string }) => void;
  /** Fires when a provider is given up on entirely. */
  onFallback?: (info: { from: string; to: string | null }) => void;
  /** Reasoning text, for the live status list. Never part of the result. */
  onThought?: (text: string) => void;
}

/** Models sometimes wrap JSON in a fence despite being told not to. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/**
 * Runs a generation against the chain for `role` and returns the parsed result.
 *
 * Everything is buffered rather than streamed to the caller, and that is the
 * point: the response is only usable if it parses, so a provider that returns
 * a truncated or malformed document is treated exactly like one that returned
 * 503 — log it and move to the next. Streaming the raw text out would commit
 * us to the first provider that produced *any* bytes, which is how a single
 * bad response used to fail the whole build.
 *
 * Reasoning arrives through `onThought` as it happens, because status labels
 * are cosmetic and cost nothing if the attempt is later abandoned.
 */
export async function generateJson<T>({
  request,
  role,
  parse,
  events = {},
}: {
  request: GenerationRequest;
  role: ProviderRole;
  /** Turns raw model output into the result. Throw to reject the attempt. */
  parse: (raw: string) => T;
  events?: GenerationEvents;
}): Promise<{ value: T; provider: AiProvider; model: string }> {
  const providers = providersForRole(role);

  if (providers.length === 0) {
    throw new Error(
      "No AI provider is configured. Set OPEN_AI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY.",
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
        try {
          events.onAttempt?.({ provider, model });

          const source =
            provider.id === "gemini"
              ? geminiStream(apiKey, model, request, provider.maxOutputTokens)
              : openAiCompatibleStream(provider, apiKey, request);

          let output = "";
          for await (const chunk of source) {
            if (chunk.kind === "output") output += chunk.text;
            else events.onThought?.(chunk.text);
          }

          return { value: parse(stripCodeFence(output)), provider, model };
        } catch (error) {
          const retryable =
            isTransient(error) ||
            error instanceof TruncatedResponseError ||
            error instanceof SyntaxError; // JSON.parse rejected the document

          if (!retryable) throw error;

          lastError = error;
          console.warn(
            `[ai] ${provider.id}/${model} attempt ${attempt}/2 failed:`,
            error instanceof Error ? error.message.slice(0, 120) : error,
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

  console.error("[ai] every provider failed; last error:", lastError);
  throw new AllProvidersUnavailableError(
    lastError instanceof Error ? lastError.message.slice(0, 120) : undefined,
  );
}
