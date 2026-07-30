/** A workspace as the projects grid sees it — no file payloads, no transcript. */
export interface ProjectSummary {
  id: string;
  title: string | null;
  /** First thing the user asked for, truncated for the card preview. */
  firstPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}
