// Attach the source sentence behind each citation, written by code (never the
// model) so the UI can show what a claim rests on.
import type { Answer } from "./answerSchema";
import { extractCitations } from "./safety";

export type EvidenceMap = Record<string, { kind: string; text: string }>;

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);

export function bestSentence(source: string, claim: string): string {
  const sentences = source.replace(/\s+/g, " ").split(/(?<=[.;])\s+(?=[A-Z0-9])/);
  const want = words(claim);
  let best = sentences[0] ?? "";
  let bestScore = -1;
  for (const s of sentences) {
    if (s.length < 20) continue;
    let score = 0;
    for (const w of words(s)) if (want.has(w)) score++;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best.slice(0, 400);
}

export function attachEvidence(answer: Answer, evidence: Record<string, string>): EvidenceMap {
  const out: EvidenceMap = {};
  const pairs: [string, string][] = [
    ...answer.why.map((w) => [w.citation, w.claim] as [string, string]),
    ...(answer.diagram ? [[answer.diagram.citation, answer.diagram.label] as [string, string]] : []),
    ...(answer.swapToAskAbout ? [[answer.swapToAskAbout.citation, answer.swapToAskAbout.text] as [string, string]] : []),
  ];
  for (const [citation, claim] of pairs) {
    for (const { kind, ref } of extractCitations(citation)) {
      const key = `${kind}:${ref}`;
      if (out[key]) continue;
      const src = evidence[key];
      if (kind === "G" && src) out[key] = { kind, text: src };
      else if (kind === "L" && src) out[key] = { kind, text: bestSentence(src, claim) };
    }
  }
  return out;
}
