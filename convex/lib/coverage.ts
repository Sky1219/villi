// A fixed, rule-based sentence under a medicine swap; never model-written.
import type { Answer } from "./answerSchema";

export const COVERAGE_NOTE =
  "Liquid and immediate-release forms sometimes cost more or need insurance approval; ask about coverage.";

const ALT_FORM_RE = /\bliquid\b|immediate[- ]release|\boral (solution|suspension)\b|\bsuspension\b|\bsyrup\b|\belixir\b/i;

// Only for a medicine (the check read an FDA label) whose swap names a liquid or
// immediate-release form. A drink swap to an oral rehydration solution never matches.
export function coverageNoteFor(final: Answer, labelSections: string[]): string | null {
  const swap = final.swapToAskAbout?.text ?? "";
  if (!labelSections.length || !swap || /rehydration/i.test(swap)) return null;
  return ALT_FORM_RE.test(swap) ? COVERAGE_NOTE : null;
}
