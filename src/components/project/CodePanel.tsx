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
  Eye,
  Code2,
  Download,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowUp,
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

type ActiveTab = "preview" | "code";

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

// ─── Segmented control ────────────────────────────────────────────────────────

function SegmentedTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3",
        "font-mono text-[0.625rem] uppercase tracking-[0.16em] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active
          ? "bg-foreground/[0.08] text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {children}
    </button>
  );
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
  activeTab,
  setActiveTab,
  onImprove,
  onFixError,
  fileData,
  appTitle,
  isImproving,
  isProUser,
}: {
  isGenerating: boolean;
  statusLog: StatusStep[];
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
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
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex items-center gap-1">
          <SegmentedTab
            active={activeTab === "preview"}
            onClick={() => setActiveTab("preview")}
            icon={Eye}
          >
            Preview
          </SegmentedTab>
          <SegmentedTab
            active={activeTab === "code"}
            onClick={() => setActiveTab("code")}
            icon={Code2}
          >
            Code
          </SegmentedTab>
        </div>

        <div className="flex items-center gap-2">
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
          Both stay mounted so the preview iframe is never torn down; only one
          is displayed. Visibility is an inline style rather than a class or
          the `hidden` attribute because Sandpack's own CSS-in-JS sets `display`
          on these subtrees and would otherwise win. */}
      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0"
          style={{ display: activeTab === "preview" ? "block" : "none" }}
        >
          <SandpackPreview
            className="h-full"
            style={{ height: "100%" }}
            showOpenInCodeSandbox={false}
            showRefreshButton
          />
        </div>

        <div
          className="absolute inset-0"
          style={{ display: activeTab === "code" ? "flex" : "none" }}
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

        {/* Busy veil */}
        {isBusy && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm">
            <div
              aria-hidden
              className="size-7 animate-spin rounded-full border-2 border-brand/25 border-t-brand"
            />
            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-brand">
                {isImproving ? "Agent at work" : "Building"}
              </p>
              <p className="max-w-xs text-[0.8125rem] text-muted-foreground">
                {isImproving ? "Rewriting your files…" : currentStepLabel}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Preview error banner ──
          Routed to onFixError (a fresh generation), not the Pro-only agent. */}
      {previewError && !isBusy && activeTab === "preview" && (
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
  const [activeTab, setActiveTab] = useState<ActiveTab>("preview");

  // Snap back to Preview whenever a new build lands, so the result is the first
  // thing you see even if you were reading the code. Same render-phase pattern
  // as above: an effect would show one frame of the old tab first.
  const [seenFileData, setSeenFileData] = useState(fileData);
  if (fileData !== seenFileData) {
    setSeenFileData(fileData);
    if (fileData) setActiveTab("preview");
  }

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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
