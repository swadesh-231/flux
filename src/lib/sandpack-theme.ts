import type { SandpackTheme } from "@codesandbox/sandpack-react";

/**
 * Sandpack dressed in the app's own palette.
 *
 * The stock `dracula` theme drops a cold purple-and-blue editor into a warm
 * taupe product with a single gold accent — it reads as a third-party widget
 * bolted on. These are the `globals.css` dark tokens resolved to hex, because
 * Sandpack renders through CSS-in-JS outside our cascade and does colour maths
 * on some of these, so `var(--brand)` is not safe to hand it.
 *
 * Keep in sync with the `.dark` block in `globals.css`.
 */
export const fluxSandpackTheme: SandpackTheme = {
  colors: {
    surface1: "#0c0a09", // --background
    surface2: "#1d1816", // --card
    surface3: "#2b2422", // --muted
    clickable: "#aba09c", // --muted-foreground
    base: "#fbfaf9", // --foreground
    disabled: "#5c5350",
    hover: "#fbfaf9",
    accent: "#e1b767", // --brand
    error: "#ff6467", // --destructive
    errorSurface: "#2a1615",
  },
  syntax: {
    // Warm-biased so the editor sits in the same light as the rest of the page.
    plain: "#e8e2dd",
    comment: { color: "#7d736f", fontStyle: "italic" },
    keyword: "#e1b767", // gold — the one accent
    tag: "#edd5a3",
    punctuation: "#aba09c",
    definition: "#f3e2c0",
    property: "#c78a3b",
    static: "#d8b48a",
    string: "#a8b98a", // the single cool note, so strings stay scannable
  },
  font: {
    body: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    mono: 'var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace',
    size: "12.5px",
    lineHeight: "1.6",
  },
};
