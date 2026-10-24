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

export function sheetMarkdown(d: SheetData, date: string): string {
  const lines: string[] = [];
  lines.push(
    `# Appointment sheet`,
    ``,
    `Patient's anatomy: ${d.anatomyText}.`,
    `Prepared with Villi on ${date} by ${preparedBy(d.role, d.caresFor)}.`,
    ``,
  );
  lines.push(`## Questions to ask`, ``);
  if (d.open.length === 0) lines.push(`- (none open)`);
  d.open.forEach((q, i) =>
    lines.push(`${i + 1}. ${q.text}${q.itemName ? ` _(about ${q.itemName})_` : ""}${q.status === "asked" ? " _(asked, answer not logged yet)_" : ""}`),
  );
  lines.push(``, `## Patterns in the patient's log (to discuss, not conclusions)`, ``);
  if (d.patterns.length === 0) lines.push(`- Not enough entries yet.`);
  d.patterns.forEach((p) => lines.push(`- ${patternSentence(p)}`));
  if (d.warnings.length) {
    lines.push(``, `## Warning signs logged`, ``);
    d.warnings.forEach((w) => lines.push(`- ${warningSentence(w, d.language)}`));
  }
  lines.push(``, `## Medicines and what the labels say`, ``);
  if (d.meds.length === 0) lines.push(`- (no medicines on file)`);
  for (const m of d.meds) {
    const flags = m.flags.map((f) => `${f.text}${citeText(f.citation)}`).join("; ");
    lines.push(`- **${m.name}**${m.dosageForm ? `: ${m.dosageForm.toLowerCase()}` : ""}${flags ? `. Flags: ${flags}` : m.labelChecked ? ". No flags in the sections checked" : ". Label not checked yet"}`);
  }
  if (d.answered.length) {
    lines.push(``, `## Answered`, ``);
    for (const q of d.answered) {
      lines.push(`- ${q.text}`);
      if (q.answer) {
        lines.push(`  - ${q.answer.professionalType}: ${q.answer.text}`);
        if (q.answer.resultingChange) lines.push(`  - Outcome: ${CHANGE_SHORT[q.answer.resultingChange]}`);
      }
    }
  }
  lines.push(
    ``,
    `---`,
    `Villi flags and cites; it does not make treatment decisions. Label text from openFDA, which says not to rely on it alone for medical decisions.`,
  );
  return lines.join("\n");
}
