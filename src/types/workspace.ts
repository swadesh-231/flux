/**
 * The shapes that travel between the workspace page, its client components, and
 * the two generation routes.
 *
 * `messages` and `fileData` are stored as `Json` columns on `Workspace`, so
 * Prisma types them as `JsonValue`. These interfaces are the contract those
 * columns are expected to hold; anything read back out of the database is
 * validated by the `parse*` helpers in `WorkspaceClient` before it is trusted.
 */

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
  /**
   * A `data:` URL for an image the user attached to this turn. Held inline
   * rather than in object storage — see `ChatPanel.handleFileChange`, which
   * caps the file size before encoding.
   */
  imageUrl?: string;
}

/** One generated file, keyed by Sandpack path (`/App.js`, `/components/X.js`). */
export interface SandboxFile {
  code: string;
}

export interface FileData {
  files: Record<string, SandboxFile>;
  dependencies: Record<string, string>;
  title?: string;
}

/** A line in the live "what the agent is doing" list in the chat panel. */
export interface StatusStep {
  label: string;
  status: "running" | "done";
}

/** The subset of `User` the workspace needs. */
export interface WorkspaceUser {
  id: string;
  credits: number;
  plan: string;
}

/** The subset of `Workspace` the workspace page hydrates from. */
export interface WorkspaceData {
  id: string;
  title: string | null;
  messages: unknown;
  fileData: unknown;
}
