"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
  useSandpack,
} from "@codesandbox/sandpack-react";
import {
  AlertTriangle,
  ArrowUp,
  Code2,
  Download,
  Eye,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import { fluxSandpackTheme } from "@/lib/sandpack-theme";
import { cn } from "@/lib/utils";
import type { FileData, StatusStep } from "@/types/workspace";

import { PricingModal } from "./PricingModal";

// ─── Placeholder ──────────────────────────────────────────────────────────────

const PLACEHOLDER_FILES = {
  "/App.js": {
    code: `export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0c0a09",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      color: "#7d736f",
      fontSize: 13,
    }}>
      Your app renders here
    </div>
  );
}`,
  },
};

// ─── Base dependencies ────────────────────────────────────────────────────────

const BASE_DEPENDENCIES: Record<string, string> = {
  "react-is": "latest",
  "react-router-dom": "latest",
  "lucide-react": "latest",
  recharts: "latest",
  "date-fns": "latest",
  "framer-motion": "latest",
  "react-hook-form": "latest",
  "@hookform/resolvers": "latest",
  zod: "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-dropdown-menu": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-tooltip": "latest",
  "@radix-ui/react-accordion": "latest",
  "@radix-ui/react-select": "latest",
  axios: "latest",
  clsx: "latest",
  "class-variance-authority": "latest",
  "tailwind-merge": "latest",
};

// ─── Types ────────────────────────────────────────────────────────────────────

/** Only one is on screen at a time; Preview is the default. */
type Pane = "preview" | "code";

/** How long to wait for the bundler iframe before re-fetching it. */
const BUNDLER_TIMEOUT_MS = 20_000;

/** Re-fetches of the bundler before giving up and showing Sandpack's message. */
const MAX_BUNDLER_RETRIES = 2;

interface CodePanelProps {
  fileData: FileData | null;
  isGenerating: boolean;
  statusLog: StatusStep[];
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
}

// ─── SandpackInner ────────────────────────────────────────────────────────────
// Lives inside SandpackProvider so it can call useSandpack().
//
// Note there is deliberately no <SandpackLayout> here. It sizes its children
// through a `> .sp-stack` child selector, so anything wrapped — a tab panel, a
// flex row — silently loses its height and the panels stack on top of one
// another. Laying the panes out directly is both simpler and predictable.

function SandpackInner({
  isGenerating,
  statusLog,
  onImprove,
  onFixError,
  onBundlerTimeout,
  fileData,
  appTitle,
  isImproving,
  isProUser,
}: {
  isGenerating: boolean;
  statusLog: StatusStep[];
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  /** Stable, or the effect below re-fires on every render. */
  onBundlerTimeout: () => void;
  fileData: FileData | null;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
}) {
  const { sandpack, listen } = useSandpack();

  // Watchdog on the bundler, re-armed per build.
  //
  // Everything here depends on `*-sandpack.codesandbox.io`, which fails in two
  // different ways: the iframe fetch 503s, or it connects and then never
  // finishes bundling. Sandpack's own `status: "timeout"` catches only the
  // first — it clears the timer the moment the client connects — and it retries
  // neither. So key off the thing that actually matters: a compile that never
  // reports back. Reaching the deadline hands control to CodePanel, which
  // rebuilds the client. That is what reloading the page did, minus losing the
  // transcript.
  // `listen` is a plain function inside SandpackProvider, not a useCallback, so
  // it is a new identity on every render. Held in a ref rather than listed as a
  // dependency below — as a dependency it would re-arm the timer on every
  // render, and a watchdog that is permanently reset never barks.
  const listenRef = useRef(listen);
  useEffect(() => {
    listenRef.current = listen;
  });

  useEffect(() => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) onBundlerTimeout();
    }, BUNDLER_TIMEOUT_MS);

    const unsubscribe = listenRef.current((msg) => {
      if (msg.type === "success" || msg.type === "done") {
        settled = true;
        window.clearTimeout(timer);
      }
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [fileData, onBundlerTimeout]);

  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [improveInput, setImproveInput] = useState("");
  const [showImproveInput, setShowImproveInput] = useState(false);
  const [activePane, setActivePane] = useState<Pane>("preview");

  // Push a finished build into the live client.
  //
  // SandpackProvider also reacts to the `files` prop on its own, but that path
  // alone is not dependable: it hands the client an update only
  // `if (client.status === "done")` and never retries, so anything that lands
  // while the iframe is busy is dropped silently. Calling `updateFile` sets
  // `shouldUpdatePreview` and re-arms the recompile, which is a second, cheaper
  // chance at delivery than tearing down the bundler and re-fetching it.
  const prevFilesRef = useRef<Record<string, { code: string }>>({});
  useEffect(() => {
    if (!fileData?.files) return;
    const prev = prevFilesRef.current;
    for (const [path, { code }] of Object.entries(fileData.files)) {
      if (prev[path]?.code !== code) sandpack.updateFile(path, code);
    }
    prevFilesRef.current = fileData.files;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData?.files]);

  // Listen for Sandpack runtime errors
  useEffect(() => {
    const unsubscribe = listen((msg) => {
      if (
        msg.type === "action" &&
        "action" in msg &&
        msg.action === "show-error"
      ) {
        setPreviewError(
          "message" in msg && typeof msg.message === "string"
            ? msg.message
            : "An error occurred in the preview.",
        );
        return;
      }
      if (msg.type === "compile") {
        setPreviewError(
          "message" in msg && typeof msg.message === "string"
            ? msg.message
            : "Compile error in preview.",
        );
        return;
      }
      if (msg.type === "success") setPreviewError(null);
    });
    return unsubscribe;
  }, [listen]);

  // Drop a stale error the moment a new build arrives, rather than waiting for
  // Sandpack to recompile and emit `success`. Adjusting state during render off
  // a changed prop is the documented alternative to an effect here — an effect
  // would land a frame later, flashing the previous error over the new app.
  const [seenFileData, setSeenFileData] = useState(fileData);
  if (fileData !== seenFileData) {
    setSeenFileData(fileData);
    setPreviewError(null);
    // A finished build should show its result, even if you were reading code.
    if (fileData) setActivePane("preview");
  }

  const handleImproveSubmit = async () => {
    const trimmed = improveInput.trim();
    if (!trimmed || isImproving) return;
    setImproveInput("");
    setShowImproveInput(false);
    await onImprove(trimmed);
  };

  // ── Export to ZIP ──────────────────────────────────────────────────────────
  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const filesToZip =
        Object.keys(sandpack.files).length > 0
          ? sandpack.files
          : (fileData?.files ?? {});

      const dependencies = {
        ...BASE_DEPENDENCIES,
        ...(fileData?.dependencies ?? {}),
      };

      const zip = new JSZip();
      const appName = appTitle
        ? appTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        : "flux-app";

      zip.file(
        "package.json",
        JSON.stringify(
          {
            name: appName || "flux-app",
            version: "1.0.0",
            private: true,
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              "react-scripts": "5.0.1",
              ...dependencies,
            },
            scripts: {
              start: "react-scripts start",
              build: "react-scripts build",
            },
            browserslist: {
              production: [">0.2%", "not dead", "not op_mini all"],
              development: ["last 1 chrome version"],
            },
          },
          null,
          2,
        ),
      );

      zip.file(
        "public/index.html",
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${appTitle ?? "Flux App"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
      );

      for (const [filePath, fileObj] of Object.entries(filesToZip)) {
        const code =
          typeof fileObj === "object" && fileObj !== null && "code" in fileObj
            ? (fileObj as { code: string }).code
            : "";
        zip.file(
          filePath.startsWith("/") ? `src${filePath}` : `src/${filePath}`,
          code,
        );
      }

      zip.file(
        "src/index.js",
        `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);`,
      );

      zip.file(
        "README.md",
        `# ${appTitle ?? "Flux App"}\n\nGenerated with Flux.\n\n## Getting started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n`,
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${appName || "flux-app"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const currentStepLabel =
    statusLog[statusLog.length - 1]?.label ?? "Generating…";
  const isBusy = isGenerating || isImproving;

  return (
    // `min-w-0 flex-1` matters: the SandpackProvider wrapper is a flex row, so
    // without it this column sizes to its content and the preview renders in a
    // narrow strip with dead space beside it.
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      {/* ── Toolbar ── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        {/* One pane at a time — Preview is the default, because the finished
            app is what you want to see first. */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-border p-0.5">
          {/* Code first so it reads left-to-right as code → preview, matching
              how the two are talked about. Preview is still what opens. */}
          {(["code", "preview"] as const).map((pane) => {
            const Icon = pane === "preview" ? Eye : Code2;
            const active = activePane === pane;
            return (
              <button
                key={pane}
                type="button"
                onClick={() => setActivePane(pane)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-6 items-center gap-1.5 rounded-full px-3",
                  "font-mono text-[0.625rem] uppercase tracking-[0.16em] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  active
                    ? "bg-foreground/[0.09] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3" aria-hidden />
                {pane}
              </button>
            );
          })}
        </div>

        {/* Live status, in the chrome rather than over the panes. */}
        {isBusy && (
          <p
            aria-live="polite"
            className="ml-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
          >
            <span
              aria-hidden
              className="size-3 shrink-0 animate-spin rounded-full border border-brand/25 border-t-brand"
            />
            <span className="truncate">
              {isImproving ? "Agent is rewriting your files…" : currentStepLabel}
            </span>
          </p>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* ── Improve ── */}
          {isProUser ? (
            showImproveInput ? (
              <div className="flex items-center gap-1">
                <div className="relative flex items-center">
                  <Sparkles
                    className="pointer-events-none absolute left-2.5 size-3 text-brand"
                    aria-hidden
                  />
                  <input
                    autoFocus
                    value={improveInput}
                    onChange={(e) => setImproveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleImproveSubmit();
                      if (e.key === "Escape") setShowImproveInput(false);
                    }}
                    placeholder="What should the agent improve?"
                    className="h-7 w-64 rounded-full border border-border bg-card/60 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-brand/40 focus:outline-none"
                  />
                </div>
                <Button
                  size="icon-xs"
                  onClick={handleImproveSubmit}
                  disabled={!improveInput.trim() || isImproving}
                  className="rounded-full"
                  aria-label="Send to agent"
                >
                  {isImproving ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp aria-hidden />
                  )}
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setShowImproveInput(false)}
                  aria-label="Cancel"
                >
                  <X aria-hidden />
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="outline"
                className="rounded-full"
                onClick={() => setShowImproveInput(true)}
                disabled={isImproving || !fileData}
              >
                {isImproving ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="text-brand" aria-hidden />
                )}
                {isImproving ? "Improving" : "Improve"}
              </Button>
            )
          ) : (
            <PricingModal reason="upgrade">
              <span
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-3",
                  "font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground",
                  "transition-colors hover:border-brand/30 hover:text-foreground",
                )}
              >
                <Sparkles className="size-3 text-brand" aria-hidden />
                Improve
                <span className="ml-0.5 rounded-full bg-brand/15 px-1.5 py-px text-[0.5625rem] text-brand">
                  Pro
                </span>
              </span>
            </PricingModal>
          )}

          <Button
            size="xs"
            variant="ghost"
            className="rounded-full"
            onClick={handleExportZip}
            disabled={isExporting || !fileData}
          >
            {isExporting ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Download aria-hidden />
            )}
            Download
          </Button>
        </div>
      </div>

      {/* ── Panes ──
          Exactly one is displayed, but both stay mounted: unmounting the
          preview tears down and reboots the Sandpack iframe, losing the
          running app's state every time you glance at the code. Visibility is
          an inline style rather than a class or the `hidden` attribute,
          because Sandpack's CSS-in-JS sets `display` on these subtrees and
          would otherwise win. */}
      <div className="relative min-h-0 flex-1">
        {/* Preview, framed like a browser window so it reads as the finished
            product rather than a bare iframe bolted into the panel. */}
        <div
          className="absolute inset-0 flex flex-col bg-muted/20 p-3"
          style={{ display: activePane === "preview" ? "flex" : "none" }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_20px_50px_-30px_rgb(0_0_0/0.9)]">
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-card/60 px-3">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2 rounded-full bg-foreground/15" />
                <span className="size-2 rounded-full bg-foreground/15" />
                <span className="size-2 rounded-full bg-foreground/15" />
              </span>
              <span className="mx-auto max-w-[60%] truncate rounded-full bg-muted/60 px-3 py-0.5 font-mono text-[0.5625rem] tracking-wide text-muted-foreground">
                {appTitle
                  ? `${appTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.flux.app`
                  : "preview"}
              </span>
            </div>

            <div className="min-h-0 flex-1">
              <SandpackPreview
                className="h-full"
                style={{ height: "100%" }}
                showOpenInCodeSandbox={false}
                showRefreshButton
              />
            </div>
          </div>
        </div>

        {/* Code */}
        <div
          className="absolute inset-0"
          style={{ display: activePane === "code" ? "flex" : "none" }}
        >
          <SandpackFileExplorer
            style={{
              height: "100%",
              width: 190,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
            }}
          />
          <SandpackCodeEditor
            style={{ height: "100%", flex: 1, minWidth: 0 }}
            showTabs
            showLineNumbers
            showInlineErrors
            closableTabs
            readOnly
          />
        </div>

        {/* Progress is a hairline at the top edge, not a veil over the pane. */}
        {isBusy && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px overflow-hidden bg-brand/15"
          >
            <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] bg-brand" />
          </div>
        )}
      </div>

      {/* ── Preview error banner ──
          Routed to onFixError (a fresh generation), not the Pro-only agent. */}
      {previewError && !isBusy && (
        <div className="shrink-0 border-t border-destructive/25 bg-destructive/[0.06] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 size-3.5 shrink-0 text-destructive"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-destructive">
                Preview error
              </p>
              <p className="mt-1 line-clamp-2 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                {previewError}
              </p>
            </div>
            <Button
              size="xs"
              variant="outline"
              className="shrink-0 rounded-full"
              onClick={() => onFixError(previewError)}
            >
              Fix it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CodePanel (outer) ────────────────────────────────────────────────────────

export function CodePanel({
  fileData,
  isGenerating,
  statusLog,
  onImprove,
  onFixError,
  appTitle,
  isImproving,
  isProUser,
}: CodePanelProps) {
  // Memoised because SandpackProvider watches these by *identity*
  // (`useFiles` re-runs on `[files, customSetup, template]`). Rebuilding either
  // object inline meant every CodePanel render — and `statusLog` changes many
  // times per generation — reset Sandpack's file state from props and re-armed
  // its 500ms recompile debounce, cancelling the pending one each time. The
  // preview could sit through a whole build never being told to recompile.
  const files = useMemo(
    () => fileData?.files ?? PLACEHOLDER_FILES,
    [fileData?.files],
  );

  const customSetup = useMemo(
    () => ({
      dependencies: { ...BASE_DEPENDENCIES, ...(fileData?.dependencies ?? {}) },
    }),
    [fileData?.dependencies],
  );

  // Remount only when the *dependency set* changes — never for code changes.
  //
  // This was keyed on the file path set, which meant the first generation
  // (almost always moving off PLACEHOLDER_FILES' single `/App.js`) tore the
  // provider down. A remount builds a new bundler iframe, re-fetched from
  // `*-sandpack.codesandbox.io`, and that host 503s often enough to matter; a
  // failed fetch leaves Sandpack on its loading overlay with no retry. That is
  // the "I have to refresh to see the output" symptom — the refresh being
  // nothing more than a second attempt at the CDN.
  //
  // Code changes need no remount: SandpackProvider's `useFiles` watches
  // `[files, customSetup, template]` and `updateFile` pushes into the live
  // client. New *packages* are the one thing it cannot do — dependencies reach
  // the bundler as a generated `/package.json`, but a client that has already
  // installed will not install again, so the app renders against the old
  // module set. Keying here means we pay for a fresh bundler exactly when a
  // build introduces a package, and not on every prompt.
  const dependencyKey = useMemo(
    () =>
      Object.entries(customSetup.dependencies)
        .map(([name, version]) => `${name}@${version}`)
        .sort()
        .join("|"),
    [customSetup],
  );

  // Bumped when the bundler fails to come up, which remounts the provider and
  // re-fetches it. Capped, so a genuine outage settles on Sandpack's own
  // timeout message instead of reloading forever.
  const [attempt, setAttempt] = useState(0);
  const handleBundlerTimeout = useCallback(() => {
    setAttempt((n) => (n < MAX_BUNDLER_RETRIES ? n + 1 : n));
  }, []);

  // A new dependency set is a new boot and deserves its own retry budget.
  const [seenDependencyKey, setSeenDependencyKey] = useState(dependencyKey);
  if (dependencyKey !== seenDependencyKey) {
    setSeenDependencyKey(dependencyKey);
    setAttempt(0);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <SandpackProvider
        key={`${dependencyKey}#${attempt}`}
        template="react"
        theme={fluxSandpackTheme}
        files={files}
        customSetup={customSetup}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"],
          // Immediate, not delayed: a build lands once, and the 500ms debounce
          // was a window in which an unrelated re-render could cancel it.
          recompileMode: "immediate",
          // The bundler starts as soon as the panel mounts rather than waiting
          // on an IntersectionObserver — the preview is on screen from the
          // first paint, and a boot in flight before the first build finishes
          // is a boot that is not on the critical path.
          initMode: "immediate",
          // Sandpack's own default is 40s. Halved, because this is now a retry
          // trigger rather than a message the user reads: 40 seconds of blank
          // preview is already long past the point of reaching for reload.
          bundlerTimeOut: BUNDLER_TIMEOUT_MS,
        }}
        style={{ height: "100%", minHeight: 0, display: "flex" }}
      >
        <SandpackInner
          isGenerating={isGenerating}
          statusLog={statusLog}
          onImprove={onImprove}
          onFixError={onFixError}
          onBundlerTimeout={handleBundlerTimeout}
          fileData={fileData}
          appTitle={appTitle}
          isImproving={isImproving}
          isProUser={isProUser}
        />
      </SandpackProvider>
    </div>
  );
}
