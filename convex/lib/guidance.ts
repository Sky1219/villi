// "Against guidance": a good or neutral log for an item Villi flagged for this anatomy.
// Such a log stays in the person's own log and never moves the shared counts, so the
// community can't drift into vouching for something a guideline says to avoid.
// Pure helpers here; the database lookups live in logs.ts.

export type GuidanceConflict = { item: string; why: string; source: "check" | "review" };

// Only these outcomes would read as "it was fine"; "worse" agrees with the flag.
export const isGoodOutcome = (outcome: string) => outcome === "helped" || outcome === "neutral";

export const AGAINST_GUIDANCE_NUDGE =
  "Kept in your own log only. Villi flagged this for this anatomy, so it isn't added to the shared counts. How it went is worth telling the care team.";

// Lowercase words, without strengths ("50 mg") or punctuation.
export function normalizeItem(s: string): string {
  return s
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%|units?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "metoprolol succinate er" matches "Metoprolol succinate ER 50 mg", and so does the
// first word or words of it ("metoprolol"). Erring toward a match only ever means asking
// once more and keeping an entry private.
export function sameItem(typed: string, name: string): boolean {
  const a = normalizeItem(typed);
  const b = normalizeItem(name);
  if (a.length < 3 || !b) return false;
  return a === b || b.startsWith(`${a} `);
}
