// The wallet card: the anatomy, each medicine on file with what the list review found,
// and one question for whoever prescribes next. Built only from the sheet's existing review.
type Med = { name: string; state: "flagged" | "nothing-found" | "cant-tell"; requestFlags: { text: string }[] };

export const CARD_QUESTION =
  "Is the form of any new or changed medicine (extended-release, delayed-release, enteric-coated, or a liquid with sorbitol) suited to this anatomy?";

export function cardLine(m: Med): string {
  // Each flag is already a sentence; one that ends in a quote gets no extra period.
  if (m.state === "flagged") return m.requestFlags.map((f) => (/[."]$/.test(f.text.trim()) ? f.text.trim() : `${f.text.trim()}.`)).join(" ");
  if (m.state === "nothing-found") return "Nothing found in the label sections checked.";
  return "Label not checked yet.";
}

// Flagged medicines first, so the short card shows them before it runs out of room.
export function cardMeds<T extends Med>(meds: T[]): T[] {
  const rank = { flagged: 0, "cant-tell": 1, "nothing-found": 2 } as const;
  return [...meds].sort((a, b) => rank[a.state] - rank[b.state]);
}
