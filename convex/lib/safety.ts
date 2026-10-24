// Deterministic safety checks that run before (and regardless of) the Claude
// reviewer. Pure functions: unit-testable with no API key, and they fail closed.
import { AnswerSchema, type Answer, type ReviewerDecision } from "./answerSchema";
import { captionFor, type PermeabilityClass } from "./cat";
import type { DiagramState } from "./anatomy";

// Everything the agent actually retrieved during this run. Citations must point here.
export type CitationRegistry = {
  guidelineIds: string[];
  labelSections: string[];
  communityTotals: number[];
  careTeamIds: string[];
  // Strengths that identify the product itself (e.g. "50 mg" in "metoprolol succinate ER 50 mg").
  allowedStrengths: string[];
  // Fixed diagram payloads of retrieved guideline chunks. When present, a
  // diagram is only shown if it cites one of these, and is replaced by it.
  diagrams?: Record<string, { segmentIds: string[]; mode: "absorbs-here" | "releases-here" | "missing"; label: string }>;
  language?: string;
  // Name words of the user's other medicines. Villi checks one item and is not an
  // interaction checker, so no retrieved source can back a claim about these.
  otherMedWords?: string[];
  // Whether any community count retrieved in this run included synthetic rows.
  communitySynthetic?: boolean;
  // Swap groups query_swaps returned (what other users switched to). A swap
  // labeled "community" needs one; otherwise it is a guideline swap.
  communitySwaps?: string[];
  // Every count cell retrieved in this run, so a [C:n/total, anatomy] citation's
  // numerator and denominator both have to match one cell for that anatomy.
  communityCells?: CommunityCell[];
  // Inputs to the illustrative CAT animation, set by code: the user's drawn anatomy,
  // the checked item's deterministic release form, and its permeability class.
  simulation?: { diagram: DiagramState; releaseForm: string | null; permeabilityClass: PermeabilityClass };
};

// `key` is an anatomy key, or "other" for the pooled other-anatomies cell.
export type CommunityCell = { key: string; total: number; counts: number[] };

// Which anatomy a citation's free-text label names, if any. Jejunostomy is
// checked first because its label says "no colon".
export function anatomyKeyInCitation(text: string): string | null {
  const t = text.toLowerCase();
  if (/jejunostomy/.test(t)) return "end-jejunostomy";
  if (/ileostomy/.test(t)) return "ileostomy";
  if (/colostomy/.test(t)) return "colostomy";
  if (/colon|continuity/.test(t)) return "colon-in-continuity";
  if (/other|everyone|all anatom/.test(t)) return "other";
  return null;
}

// First distinctive word of each medicine on file that isn't the item being checked.
export function otherMedWords(meds: string[], checked: string[]): string[] {
  const seen = checked.join(" ").toLowerCase();
  return meds
    .map((m) => m.toLowerCase().match(/[a-z]{4,}/)?.[0])
    .filter((w): w is string => !!w && !seen.includes(w));
}

export const emptyRegistry = (): CitationRegistry => ({
  guidelineIds: [],
  labelSections: [],
  communityTotals: [],
  careTeamIds: [],
  allowedStrengths: [],
});

const CITATION_RE = /\[(G|L|C|T):([^\]]+)\]/g;

export function extractCitations(text: string): { kind: string; ref: string }[] {
  return Array.from(text.matchAll(CITATION_RE), (m) => ({ kind: m[1], ref: m[2].trim() }));
}

// Returns null when valid, otherwise a reason.
// Bare counts in a claim ("5 of 13 people"), not lengths, percentages or concentrations.
function countsInClaim(claim: string): number[] {
  return Array.from(claim.matchAll(/\b(\d+)\b(?!\s*(?:cm|%|mmol|mg|mcg|ml|mL|g\b|percent))/g), (m) => Number(m[1]));
}

export function checkCitation(citation: string, reg: CitationRegistry, claim = ""): string | null {
  const cites = extractCitations(citation);
  if (cites.length === 0) return `no citation in "${citation}"`;
  for (const { kind, ref } of cites) {
    if (kind === "G" && !reg.guidelineIds.includes(ref)) return `unknown guideline ${ref}`;
    if (kind === "L" && !reg.labelSections.includes(ref)) return `label section ${ref} was not retrieved`;
    if (kind === "T" && !reg.careTeamIds.includes(ref)) return `unknown care-team answer ${ref}`;
    if (kind === "C") {
      const m = ref.match(/^(\d+)\s*\/\s*(\d+)\s*,\s*(.+)$/);
      if (!m) return `community citation "${ref}" needs n/total and anatomy`;
      const n = Number(m[1]);
      const total = Number(m[2]);
      if (n > total || total === 0) return `community citation "${ref}" is not a valid fraction`;
      if (!reg.communityTotals.includes(total)) return `community total ${total} does not match retrieved counts`;
      if (reg.communityCells) {
        const key = anatomyKeyInCitation(m[3]);
        const cells = reg.communityCells.filter((c) => c.total === total && (!key || c.key === key));
        if (!cells.some((c) => c.counts.includes(n) || n === total)) {
          return `community count ${n}/${total} does not match a retrieved count for that anatomy`;
        }
        // The claim's own numbers must come from the same cells (it once said 5/5/3 under [C:13/13]).
        const allowed = new Set(cells.flatMap((c) => [...c.counts, c.total]));
        const stray = countsInClaim(claim).find((x) => !allowed.has(x));
        if (stray !== undefined) return `claim number ${stray} does not match the cited community counts`;
      }
    }
  }
  return null;
}

const QUANTITY_RE =
  /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|grams?|milligrams?|micrograms?|ml|mL|millilit(?:er|re)s?|lit(?:er|re)s?|L|tablets?|capsules?|pills?|doses?|cups?|glass(?:es)?|ounces?|oz|teaspoons?|tablespoons?|tsp|tbsp|calories|kcal|servings?|times (?:a|per) day)\b|\b(?:one|two|three|four|five|six|half|a half|half (?:a|of (?:a|the|your|his|her)))\s+(?:tablets?|capsules?|pills?|doses?|cups?|glass(?:es)?|teaspoons?|tablespoons?|lit(?:er|re)s?|bottles?)\b|\b(?:twice|three times|four times)\s+(?:a|per|each)\s+day\b|\btwice daily\b|\bevery\s+\d+\s+hours?\b/gi;

const DIRECTIVE_RES = [
  /\b(?:you should|you can|you could|you may|go ahead and|try to|try|just|it's (?:ok|okay|fine) to)\s+(?:safely\s+)?(?:stop|start|crush|split|skip|chew|double|halve|cut|switch|change|increase|decrease|lower|raise|discontinue|open)\b/i,
  /(?:^|[.!?]\s+)(?:stop|start|crush|split|skip|chew|double|halve|cut|switch|discontinue|change|increase|decrease|lower|raise)\s+(?:taking\s+)?(?:your|the|this|it|that)\b/i,
  /\b(?:take|use|drink)\s+(?:half|double|twice|less|more|an extra)\b/i,
];

const OVERCERTAIN_RE =
  /\b(?:is (?:perfectly |completely |totally )?safe|guaranteed|definitely (?:fine|safe|works)|no risk|nothing to worry about|totally fine)\b/i;

function userFacingTexts(a: Answer): string[] {
  return [
    a.verdict,
    ...a.why.map((w) => w.claim),
    a.swapToAskAbout?.text ?? "",
    ...a.personal,
    ...a.careTeamAnswers.map((c) => c.summary),
    a.diagram?.label ?? "",
    a.simulation?.caption ?? "",
  ];
}

// Silence is not reassurance: a no-concern verdict always names its limits.
export const NOTHING_FOUND_PREFIX = "Nothing in the sources I checked raised a concern. ";

export type LintResult = {
  answer: Answer; // with uncited claims removed
  issues: string[]; // everything found
  blocking: string[]; // subset that blocks the answer outright
};

export function lintAnswer(input: Answer, reg: CitationRegistry): LintResult {
  const issues: string[] = [];
  const blocking: string[] = [];
  const answer: Answer = structuredClone(input);

  // 1. Uncited or mis-cited claims are deleted, not repaired.
  answer.why = answer.why.filter((w) => {
    const bad = checkCitation(w.citation, reg, w.claim);
    if (bad) issues.push(`removed claim: ${bad}`);
    return !bad;
  });
  if (answer.diagram) {
    const bad = checkCitation(answer.diagram.citation, reg);
    const g = extractCitations(answer.diagram.citation).find((c) => c.kind === "G");
    const fixed = g && reg.diagrams ? reg.diagrams[g.ref] : undefined;
    if (bad) {
      issues.push(`removed diagram: ${bad}`);
      answer.diagram = null;
    } else if (reg.diagrams && !fixed) {
      // The diagram illustrates a cited claim; it never adds one of its own.
      issues.push("removed diagram: cited chunk has no diagram payload");
      answer.diagram = null;
    } else if (fixed && g) {
      answer.diagram = {
        segmentIds: fixed.segmentIds as NonNullable<Answer["diagram"]>["segmentIds"],
        mode: fixed.mode,
        label: fixed.label,
        citation: `[G:${g.ref}]`,
      };
    }
  }
  if (answer.swapToAskAbout?.source === "community" && !(reg.communitySwaps ?? []).length) {
    issues.push("swap relabeled as a guideline swap: no community swap group was retrieved");
    answer.swapToAskAbout = { ...answer.swapToAskAbout, source: "guideline" };
    if (!extractCitations(answer.swapToAskAbout.citation).some((c) => c.kind === "G")) {
      issues.push("removed swap: a guideline swap needs a guideline citation");
      answer.swapToAskAbout = null;
    }
  }
  // The illustration's caption is a factual claim: fixed text chosen by rule, cited
  // to a guideline or this item's label, and never a number.
  const english = !reg.language || reg.language.startsWith("en");
  if (answer.simulation) {
    const sim = answer.simulation;
    const kinds = extractCitations(sim.citation).map((c) => c.kind);
    const bad =
      checkCitation(sim.citation, reg) ??
      (kinds.every((k) => k === "G" || k === "L") ? null : "needs a guideline or label citation");
    const ctx = reg.simulation;
    const expected = ctx && english ? captionFor(sim.formulation, ctx.diagram) : null;
    if (sim.caption !== undefined && /\d|percent|fraction absorbed/i.test(sim.caption)) {
      blocking.push(`numeric language in the illustration caption: "${sim.caption}"`);
    } else if (sim.caption !== undefined && sim.caption !== expected) {
      blocking.push("illustration caption is not the fixed caption for this formulation and anatomy");
    } else if (bad) {
      issues.push(`removed illustration: ${bad}`);
      answer.simulation = null;
    } else if (!ctx || ctx.releaseForm !== sim.formulation) {
      issues.push("removed illustration: formulation does not match the label's release form");
      answer.simulation = null;
    } else if (!expected) {
      issues.push("removed illustration: nothing to illustrate for this anatomy or language");
      answer.simulation = null;
    } else {
      answer.simulation = { ...sim, permeabilityClass: ctx.permeabilityClass, caption: expected };
    }
  }
  if (answer.swapToAskAbout) {
    const bad = checkCitation(answer.swapToAskAbout.citation, reg);
    if (bad) {
      issues.push(`removed swap: ${bad}`);
      answer.swapToAskAbout = null;
    }
  }
  answer.careTeamAnswers = answer.careTeamAnswers.filter((c) => {
    const ok = reg.careTeamIds.includes(c.id.replace(/^\[?T:|\]$/g, ""));
    if (!ok) issues.push(`removed care-team answer ${c.id}: not retrieved`);
    return ok;
  });
  // Personal notes describe the user's own log only; community numbers belong in `community`.
  answer.personal = answer.personal.filter((p) => {
    const leaked = /\[(G|L|C|T):/.test(p);
    if (leaked) issues.push("removed personal note that carried a citation");
    return !leaked;
  });
  // A citation to this item's label section can't back a claim about a different medicine.
  const others = reg.otherMedWords ?? [];
  const namesOther = (t: string) => others.find((w) => new RegExp(`\\b${w}\\b`, "i").test(t));
  answer.why = answer.why.filter((w) => {
    const med = namesOther(w.claim);
    if (med) issues.push(`removed claim about another medicine (${med}): not an interaction checker`);
    return !med;
  });
  for (const text of [answer.verdict, answer.swapToAskAbout?.text ?? "", answer.ask]) {
    const med = namesOther(text);
    if (med) blocking.push(`mentions another medicine on file (${med}); this answer covers only the item being checked`);
  }
  if (!answer.unidentified && answer.why.length === 0) {
    blocking.push("no cited claims remain");
  }

  // 2. No quantities, doses, or directives anywhere the user reads.
  const allowed = reg.allowedStrengths.map((s) => s.toLowerCase().replace(/\s+/g, ""));
  for (const text of [...userFacingTexts(answer), answer.ask]) {
    for (const m of text.matchAll(QUANTITY_RE)) {
      const q = m[0].toLowerCase().replace(/\s+/g, "");
      if (!allowed.includes(q)) blocking.push(`quantity or dose: "${m[0]}"`);
    }
  }
  for (const text of userFacingTexts(answer)) {
    for (const re of DIRECTIVE_RES) {
      const m = text.match(re);
      if (m) blocking.push(`medication directive: "${m[0].trim()}"`);
    }
    const oc = text.match(OVERCERTAIN_RE);
    if (oc) blocking.push(`more certainty than sources support: "${oc[0]}"`);
  }

  // 3. Exactly one question for a professional, on a line starting "ASK:".
  const ask = answer.ask.trim();
  if (!ask.startsWith("ASK:")) blocking.push("missing ASK line");
  const allText = [...userFacingTexts(answer), ask].join("\n");
  if ((allText.match(/ASK:/g) ?? []).length !== 1) blocking.push("must have exactly one ASK line");
  // Latin, full-width (Chinese) and Arabic question marks.
  if ((ask.match(/[?？؟]/g) ?? []).length !== 1) blocking.push("ASK must be exactly one question");

  // 4. Silence is not reassurance.
  if (!answer.unidentified && answer.sourcesChecked.length === 0) {
    blocking.push("sources checked are not listed");
  }
  // The exact wording is repaired in English; the reviewer checks its meaning in other languages.
  if (english && answer.state === "nothing-found" && !/nothing in the sources i checked/i.test(answer.verdict)) {
    answer.verdict = `${NOTHING_FOUND_PREFIX}${answer.verdict}`;
    issues.push('added "nothing in the sources I checked" to a no-concern verdict');
  }
  if (answer.unidentified && answer.state !== "cant-tell") blocking.push("unidentified items must be cant-tell");

  return { answer, issues: [...issues, ...blocking], blocking };
}

function citationSet(a: Answer): Set<string> {
  const texts = [
    ...a.why.map((w) => w.citation),
    a.diagram?.citation ?? "",
    a.swapToAskAbout?.citation ?? "",
    a.simulation?.citation ?? "",
  ];
  return new Set(texts.flatMap((t) => extractCitations(t).map((c) => `${c.kind}:${c.ref}`)));
}

export type ReviewOutcome =
  | { status: "final"; final: Answer; edited: boolean; lint: string[]; decision: ReviewerDecision | null }
  | { status: "blocked"; blockedReasons: string[]; lint: string[]; decision: ReviewerDecision | null };

// Full review: deterministic lint is an unconditional gate, then the Claude
// reviewer, whose edits are linted again and may only use the draft's citations.
export async function reviewDraft(
  draft: unknown,
  reg: CitationRegistry,
  llmReview: (answer: Answer) => Promise<ReviewerDecision>,
): Promise<ReviewOutcome> {
  const parsed = AnswerSchema.safeParse(draft);
  if (!parsed.success) {
    return { status: "blocked", blockedReasons: ["draft is not valid answer JSON"], lint: [], decision: null };
  }
  const first = lintAnswer(parsed.data, reg);
  if (first.blocking.length > 0) {
    return { status: "blocked", blockedReasons: first.blocking, lint: first.issues, decision: null };
  }

  const decision = await llmReview(first.answer);
  // Edits only count when the reviewer also approved; an unapproved edit is a block.
  if (decision.edits && decision.approved) {
    let revised: Answer;
    try {
      revised = AnswerSchema.parse(JSON.parse(decision.edits));
    } catch {
      return { status: "blocked", blockedReasons: ["reviewer edit was not valid answer JSON"], lint: first.issues, decision };
    }
    const allowedCites = citationSet(first.answer);
    for (const c of citationSet(revised)) {
      if (!allowedCites.has(c)) {
        return { status: "blocked", blockedReasons: [`reviewer added citation ${c}`], lint: first.issues, decision };
      }
    }
    const second = lintAnswer(revised, reg);
    if (second.blocking.length > 0) {
      return { status: "blocked", blockedReasons: second.blocking, lint: [...first.issues, ...second.issues], decision };
    }
    return { status: "final", final: second.answer, edited: true, lint: [...first.issues, ...second.issues], decision };
  }
  if (!decision.approved) {
    return {
      status: "blocked",
      blockedReasons: decision.blockedReasons.length ? decision.blockedReasons : ["reviewer did not approve"],
      lint: first.issues,
      decision,
    };
  }
  return { status: "final", final: first.answer, edited: false, lint: first.issues, decision };
}
