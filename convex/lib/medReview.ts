// Medicine list review: an instant, deterministic first pass over one medicine
// on file. Pure, so it is unit-testable and can't fail on stage. Every flag's
// medical claim is the cited guideline chunk's own text; the flag sentence is a
// fixed template that only says what the label or NDC listing shows.
import corpus from "../../data/guidelines.json";
import { computeFlags, releaseFormOf, type ReleaseForm } from "../fda";

export type ReviewCitation = {
  key: string; // "G:<chunkId>" or "L:<section>"
  label: string; // short source label for the chip
  text: string; // what the chip opens: the chunk text, or the label wording
  source?: string; // full source title (guidelines only)
  section?: string; // where in the source (guidelines only)
  verifiedAgainst?: string; // "abstract" | "full text" when Claude checked it
};

export type ReviewFlag = {
  kind: "extended-release" | "delayed-release" | "sugar-alcohol" | "swallow-whole";
  text: string;
  citations: ReviewCitation[];
};

export type MedReview = {
  state: "flagged" | "nothing-found" | "cant-tell";
  // Plain sentence shown under the state; never "safe".
  summary: string;
  flags: ReviewFlag[];
  // Label sections actually read, in plain words. Empty unless the label was found.
  sectionsChecked: string[];
};

export type MedReviewInput = {
  name: string;
  // NDC dosage form (from the cached label, else what was stored on the med).
  dosageForm: string | null;
  // null: the label lookup hasn't run yet. found false: no FDA label under this name.
  label: { found: boolean; sections: Record<string, string> } | null;
  scopeTags: string[];
};

type Chunk = { sourceId: string; locator: string; text: string; anatomyScope: string[]; section?: string; verified: boolean; verifiedAgainst?: string };
const SOURCES = corpus.sources as Record<string, { title: string }>;
const CHUNKS = new Map((corpus.chunks as Chunk[]).map((c) => [`${c.sourceId}#${c.locator}`, c]));

const SHORT: Record<string, string> = {
  "aga-sbs": "AGA 2022",
  pg139: "Pract Gastro 2015",
  "pd-2017": "Parrish & DiBaise 2017",
  "remane-2025": "Remane 2025",
  "sood-2013": "Aust Prescr 2013",
  "hong-2021": "Hong 2021",
  "who-ors": "WHO ORS",
  "uoaa-2025": "UOAA 2025",
};

// Fixed mapping from flag to the guideline chunks that speak to it. Anatomy
// scope filters it per person; a flag with no chunk in scope is not shown.
export const FLAG_CHUNKS: Record<ReviewFlag["kind"] | "ppi", string[]> = {
  "extended-release": ["aga-sbs#medications-release-forms", "pg139#extended-release-avoid", "sood-2013#formulation", "sood-2013#colon-slow-release"],
  "delayed-release": ["aga-sbs#medications-release-forms", "pg139#enteric-coating", "sood-2013#formulation"],
  // Delayed-release acid suppressants are routine after resection: the chunks say so, and that the team chooses the form.
  ppi: ["pg139#ppi", "sood-2013#ppi", "aga-sbs#acid-suppression"],
  "sugar-alcohol": ["sood-2013#liquid-excipients", "pg139#sugar-alcohols"],
  "swallow-whole": ["sood-2013#ask-before-changing-form"],
};

const SECTION_WORDS: Record<string, string> = {
  dosage_form: "dosage form (NDC)",
  dosage_and_administration: "dosage and administration",
  spl_product_data_elements: "ingredients list",
  inactive_ingredient: "inactive ingredients",
  description: "description",
};

export const isAcidSuppressant = (name: string) => /\b\w*prazole\b|\b(?:protonix|prilosec|nexium|prevacid|aciphex|dexilant)\b/i.test(name);

function guideline(chunkIds: string[], scopeTags: string[]): ReviewCitation[] {
  const out: ReviewCitation[] = [];
  for (const id of chunkIds) {
    const c = CHUNKS.get(id);
    if (!c || !c.anatomyScope.some((s) => scopeTags.includes(s))) continue;
    out.push({
      key: `G:${id}`,
      label: SHORT[c.sourceId] ?? c.sourceId,
      text: c.text,
      source: SOURCES[c.sourceId]?.title,
      section: c.section,
      verifiedAgainst: c.verified ? c.verifiedAgainst : undefined,
    });
  }
  return out;
}

const labelCite = (section: string, text: string): ReviewCitation => ({
  key: `L:${section}`,
  label: `FDA label: ${SECTION_WORDS[section] ?? section.replace(/_/g, " ")}`,
  text,
});

// "Best Practice Advice 7: Drug Dosing" -> "BPA 7"; long headings cut at a word.
function shortSection(section: string): string {
  const s = section.replace(/^Best Practice Advice (\d+).*/, "BPA $1");
  if (s.length <= 24) return s;
  return `${s.slice(0, 24).replace(/\s+\S*$/, "")}…`;
}

export function reviewMed(m: MedReviewInput): MedReview {
  if (!m.label) {
    return { state: "cant-tell", summary: "Label not checked yet.", flags: [], sectionsChecked: [] };
  }
  if (!m.label.found) {
    return {
      state: "cant-tell",
      summary: "No FDA label found under this name. Check the spelling on the label, or run a full check.",
      flags: [],
      sectionsChecked: [],
    };
  }
  const { release_form: cachedRelease, other_forms: _of, ...sections } = m.label.sections;
  const form = sections.dosage_form ?? m.dosageForm ?? null;
  // Without an NDC form, fall back to what the label text said when it was fetched.
  const releaseForm: ReleaseForm = form ? releaseFormOf(form) : ((cachedRelease as ReleaseForm | undefined) ?? "unknown");
  const formSource = form ? `NDC listing: ${form.toLowerCase()}` : "from the label text";
  const flags: ReviewFlag[] = [];
  for (const f of computeFlags(sections, releaseForm)) {
    if (f.flag === "extended-release" || f.flag === "delayed-release") {
      const ppi = f.flag === "delayed-release" && isAcidSuppressant(m.name);
      const g = guideline(FLAG_CHUNKS[ppi ? "ppi" : f.flag], m.scopeTags);
      if (!g.length) continue;
      flags.push({
        kind: f.flag,
        text: ppi
          ? `Delayed-release form of an acid-suppressing medicine (${formSource}).`
          : `${f.flag === "extended-release" ? "Extended-release" : "Delayed-release"} form (${formSource}).`,
        citations: [labelCite("dosage_form", form ?? `The label describes a ${f.flag} form.`), ...g],
      });
    } else if (f.flag === "sugar-alcohol") {
      const g = guideline(FLAG_CHUNKS["sugar-alcohol"], m.scopeTags);
      if (!g.length) continue;
      const liquid = releaseForm === "liquid";
      flags.push({
        kind: "sugar-alcohol",
        text: `The label lists ${f.evidence} among its ingredients${liquid ? ", in a liquid medicine" : ""}.`,
        citations: [labelCite(f.section, `Ingredients include ${f.evidence}.`), ...g],
      });
    } else if (f.flag === "swallow-whole") {
      flags.push({
        kind: "swallow-whole",
        text: `The label says: "${f.evidence}"`,
        citations: [labelCite("dosage_and_administration", f.evidence), ...guideline(FLAG_CHUNKS["swallow-whole"], m.scopeTags)],
      });
    }
  }
  // Two chips from the same source get their section, so they don't read the same.
  for (const f of flags) {
    const seen = new Map<string, number>();
    for (const c of f.citations) seen.set(c.label, (seen.get(c.label) ?? 0) + 1);
    for (const c of f.citations) {
      if ((seen.get(c.label) ?? 0) > 1 && c.section) c.label = `${c.label} · ${shortSection(c.section)}`;
    }
  }
  const sectionsChecked = ["dosage_form", "dosage_and_administration", "spl_product_data_elements", "inactive_ingredient", "description"]
    .filter((k) => !!sections[k])
    .map((k) => SECTION_WORDS[k]);
  if (flags.length) {
    return { state: "flagged", summary: flags.length === 1 ? "One thing to discuss." : `${flags.length} things to discuss.`, flags, sectionsChecked };
  }
  return {
    state: "nothing-found",
    summary: `Nothing found in the sections checked: ${sectionsChecked.join(", ") || "none of the usual sections were on this label"}.`,
    flags: [],
    sectionsChecked,
  };
}

// "ASK: With <anatomy>, is <med> the best form…": a fixed question with no dose,
// for the appointment sheet. The printed strength is dropped from the name.
export function reviewQuestion(medName: string, anatomyShort: string): string {
  const name = medName.replace(/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mL|%|units?)\b(?:\s*\/\s*\d*\s*(?:ml|mL|l))?/gi, "").replace(/\s+/g, " ").trim();
  return `With ${anatomyShort}, is ${name} the best form for absorption, or is there another form we should discuss?`;
}
