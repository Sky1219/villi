// "Safety check · 1 change": what the code check and the second review changed before
// the answer was shown, in plain words. Written by code from the lint messages and a
// diff of the draft against the final answer; never the reviewer's raw output.
import type { Answer } from "./answerSchema";

const LINT_SENTENCES: [RegExp, string][] = [
  [/^removed claim about another medicine/, "Removed a sentence about a different medicine. Villi isn't an interaction checker."],
  [/^removed claim:/, "Removed a claim whose source didn't check out."],
  [/^removed diagram/, "Removed a diagram highlight its source didn't support."],
  [/^(swap relabeled|removed swap)/, "Corrected a suggested swap so it only says what its sources support."],
  [/^removed care-team answer/, "Removed a care-team report that wasn't part of this check."],
  [/^removed personal note/, "Removed a citation from a note about your own log."],
  [/nothing in the sources I checked/, "Made clear nothing was found in the sources checked, rather than calling it safe."],
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("N", String(n)));

export function safetyChanges(linted: Answer, final: Answer, lint: string[], edited: boolean): string[] {
  const out: string[] = [];
  for (const issue of lint) {
    const hit = LINT_SENTENCES.find(([re]) => re.test(issue));
    if (hit) out.push(hit[1]);
  }
  if (edited) {
    const before = new Map(linted.why.map((w) => [w.citation, w.claim]));
    const after = new Map(final.why.map((w) => [w.citation, w.claim]));
    const removed = [...before.keys()].filter((c) => !after.has(c)).length;
    const reworded = [...after].filter(([c, claim]) => before.has(c) && before.get(c) !== claim).length;
    if (removed) out.push(plural(removed, "The second review removed a claim its source didn't fully support.", "The second review removed N claims their sources didn't fully support."));
    if (reworded) out.push(plural(reworded, "The second review reworded a claim to match its source more closely.", "The second review reworded N claims to match their sources more closely."));
    if (linted.verdict !== final.verdict) out.push("The second review reworded the summary to stay within its sources.");
    if ((linted.swapToAskAbout?.text ?? "") !== (final.swapToAskAbout?.text ?? "")) out.push("The second review reworded the suggested swap.");
    if (linted.ask !== final.ask) out.push("The second review reworded the question for the care team.");
    if (out.length === 0) out.push("The second review made a small wording change.");
  }
  return [...new Set(out)];
}
