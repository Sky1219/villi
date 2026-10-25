// From the moment the check was asked to its last trace step (the reviewer's verdict).
// Null when the times don't make sense, for example a demo answer copied from a template.
export function checkSeconds(createdAt: number, trace: { at: number }[]): number | null {
  const last = trace.at(-1)?.at;
  if (!last || last < createdAt || last - createdAt > 15 * 60_000) return null;
  return Math.round((last - createdAt) / 1000);
}
