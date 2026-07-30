import arcjet, { detectPromptInjection, tokenBucket } from "@arcjet/next";

/**
 * Route-level protection for the two generation endpoints.
 *
 * Keyed on `userId` rather than IP, so the bucket follows the account: the
 * caller must pass `{ userId }` to `aj.protect()`, and `detectPromptInjection`
 * additionally needs `{ detectPromptInjectionMessage }` — the raw user text to
 * inspect. Both are supplied by the two generation routes under `src/app/api`.
 *
 * Five tokens, refilled five per minute: enough for a burst of edits, not
 * enough to grind through a plan's credits by accident.
 */
export const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  characteristics: ["userId"],
  rules: [
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: 60,
      capacity: 5,
    }),
    detectPromptInjection({
      mode: "LIVE",
    }),
  ],
});
