import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { citationLabel } from "@/lib/citations";
import { preparedBy } from "@convex/lib/careFor";

export type SheetData = NonNullable<FunctionReturnType<typeof api.sheet.get>>;

export const OUTCOME_WORD = { helped: "helped", neutral: "no change", hurt: "worse" } as const;

export type ResultingChange = "formulation_changed" | "dose_monitored" | "no_change" | "pending";

export const CHANGE_CHOICES: readonly (readonly [ResultingChange, string])[] = [
  ["formulation_changed", "They changed the form of a medicine"],
  ["dose_monitored", "They're monitoring it (levels, readings or the effect)"],
  ["no_change", "Nothing changed"],
  ["pending", "Not decided yet"],
] as const;

export const CHANGE_SHORT: Record<ResultingChange, string> = {
  formulation_changed: "Form of the medicine changed",
  dose_monitored: "Being monitored",
  no_change: "No change",
  pending: "Not decided yet",
};

export function citeText(c: string | null): string {
  if (!c) return "";
  const [kind, ...rest] = c.split(":");
  return ` (${citationLabel(kind, rest.join(":"))})`;
}

// "Warning signs logged": the date and which signs, never the note itself.
export function warningSentence(w: SheetData["warnings"][number], locale?: string): string {
  return `${new Date(w.at).toLocaleDateString(locale)}: ${w.signs.join(", ")}${w.level === "emergency" ? " (emergency signs)" : ""}`;
}

// Patterns are hypotheses from the user's own log, never conclusions.
export function patternSentence(p: SheetData["patterns"][number]): string {
  const top = (["hurt", "helped", "neutral"] as const).reduce((a, b) => (p[b] > p[a] ? b : a));
  return `${p.item}: logged ${OUTCOME_WORD[top]} ${p[top]} of ${p.total} times (${p.helped} helped, ${p.neutral} no change, ${p.hurt} worse)`;
}

// ---- Pharmacist review request: one page a pharmacist can act on.

export const REQUEST_TITLE = "Medication review request";

export const REQUEST_FOOTER =
  "Villi is not medical advice. What Villi is: a free tool for people who've had much of their intestine removed, and their families. It reads the FDA label and published short bowel syndrome guidance, flags what may not suit this anatomy, cites both sources, and writes the question. What it isn't: a prescriber or an interaction checker. It gives no doses and makes no decisions. Label text from openFDA, which says not to rely on it alone for medical decisions; guideline lines are Villi's summaries of the cited source.";

export function anatomyLine(d: Pick<SheetData, "anatomyText" | "anatomyConfirmed">): string {
  return d.anatomyConfirmed
    ? `${d.anatomyText} (as described by the patient or family)`
    : `not confirmed. Villi is assuming the most cautious case: ${d.anatomyText}`;
}

// Short enough for one page without changing the meaning: whole sentences up to
// `max`, or, for a long ingredient list, the words around the flagged ingredient.
export function excerpt(text: string, max = 300, around?: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  if (around) {
    const i = t.toLowerCase().indexOf(around.toLowerCase());
    if (i >= 0) {
      const start = Math.max(0, t.lastIndexOf(" ", Math.max(0, i - 60)));
      const end = t.indexOf(" ", Math.min(t.length, i + around.length + 60));
      return `${start > 0 ? "…" : ""}${t.slice(start, end < 0 ? t.length : end).trim()}${end < 0 ? "" : "…"}`;
    }
  }
  let out = "";
  for (const s of t.split(/(?<=\.)\s+/)) {
    if (`${out} ${s}`.trim().length > max) break;
    out = `${out} ${s}`.trim();
  }
  return out || `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

// Whether a flag's own text already quotes or states its label line.
export function labelRepeats(flagText: string, labelText: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return norm(flagText).includes(norm(labelText).slice(0, 80));
}

// The ingredient a sugar-alcohol flag names ("The label lists mannitol among its ingredients.").
export function flaggedWord(flagText: string): string | undefined {
  return flagText.match(/lists (\w+) among/)?.[1];
}

export function guidelineCite(g: { source: string; section: string | null }): string {
  return g.section && !g.source.includes("·") ? `${g.source}, ${g.section}` : g.source;
}

export function requestMarkdown(d: SheetData, date: string): string {
  const flagged = d.meds.filter((m) => m.question);
  const clear = d.meds.filter((m) => !m.question && m.labelChecked);
  const unchecked = d.meds.filter((m) => !m.question && !m.labelChecked);
  const lines: string[] = [
    `# ${REQUEST_TITLE}`,
    ``,
    `For the pharmacist. Prepared with Villi on ${date} by ${preparedBy(d.role, d.caresFor)}.`,
    ``,
    `**Anatomy:** ${anatomyLine(d)}.`,
    ``,
    `## Medicines to review (${flagged.length})`,
    ``,
  ];
  if (flagged.length === 0) lines.push(`Nothing found in the sources I checked.`, ``);
  flagged.forEach((m, i) => {
    lines.push(`### ${i + 1}. ${m.name}${m.dosageForm ? ` (${m.dosageForm.toLowerCase()})` : ""}`);
    for (const f of m.requestFlags) {
      lines.push(`- ${f.text}`);
      if (f.label && !labelRepeats(f.text, f.label.text)) lines.push(`  - Label: "${excerpt(f.label.text, 260, flaggedWord(f.text))}" (${f.label.source})`);
      else if (f.label) lines.push(`  - Source: ${f.label.source}`);
      if (f.guideline) lines.push(`  - Guidance: ${excerpt(f.guideline.text, 300)} (${guidelineCite(f.guideline)})`);
    }
    lines.push(`- **Question:** ${m.question}`, ``);
  });
  if (clear.length) lines.push(`Nothing found in the sources I checked: ${clear.map((m) => m.name).join(", ")}.`);
  if (unchecked.length) lines.push(`Label not checked yet: ${unchecked.map((m) => m.name).join(", ")}.`);
  if (d.warnings.length) {
    lines.push(``, `## Warning signs logged`, ``);
    d.warnings.forEach((w) => lines.push(`- ${warningSentence(w, d.language)}`));
  }
  lines.push(``, `## Other open questions`, ``);
  if (d.open.length === 0) lines.push(`- (none)`);
  d.open.forEach((q, i) =>
    lines.push(`${i + 1}. ${q.text}${q.itemName ? ` _(about ${q.itemName})_` : ""}${q.status === "asked" ? " _(asked, answer not logged yet)_" : ""}`),
  );
  lines.push(``, `---`, REQUEST_FOOTER);
  return lines.join("\n");
}
