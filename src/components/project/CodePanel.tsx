"use client";

import { useEffect, useRef, useState } from "react";
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
  fileData,
  appTitle,
  isImproving,
  isProUser,
}: {
  isGenerating: boolean;
  statusLog: StatusStep[];
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  fileData: FileData | null;
  appTitle: string | null;
  isImproving: boolean;
  isProUser: boolean;
}) {
  const { sandpack, listen } = useSandpack();
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [improveInput, setImproveInput] = useState("");
  const [showImproveInput, setShowImproveInput] = useState(false);
  const [activePane, setActivePane] = useState<Pane>("preview");

  // Push file content updates into Sandpack without remounting.
  // SandpackProvider's key only changes when the file *path set* changes, so
  // this is what carries edited contents through.
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
  const files = fileData?.files ?? PLACEHOLDER_FILES;
  const dependencies = {
    ...BASE_DEPENDENCIES,
    ...(fileData?.dependencies ?? {}),
  };

  // Key on the file *path set* only — not contents. Content changes go through
  // sandpack.updateFile() inside SandpackInner, so the preview survives edits.
  const filePathKey = Object.keys(files).sort().join("|");

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <SandpackProvider
        key={filePathKey}
        template="react"
        theme={fluxSandpackTheme}
        files={files}
        customSetup={{ dependencies }}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"],
          recompileMode: "delayed",
          recompileDelay: 500,
        }}
        style={{ height: "100%", minHeight: 0, display: "flex" }}
      >
        <SandpackInner
          isGenerating={isGenerating}
          statusLog={statusLog}
          onImprove={onImprove}
          onFixError={onFixError}
          fileData={fileData}
          appTitle={appTitle}
          isImproving={isImproving}
          isProUser={isProUser}
        />
      </SandpackProvider>
    </div>
  );
}
