import { ConvexError } from "convex/values";

// Show the user the sentence we wrote, never a server stack trace.
export function friendlyError(e: unknown): string {
  if (e instanceof ConvexError) return typeof e.data === "string" ? e.data : "Something went wrong.";
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/ConvexError: ([^\n]+)/);
  if (m) return m[1].trim();
  if (/fetch|network|Failed to/i.test(msg)) return "Couldn't reach Villi. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
