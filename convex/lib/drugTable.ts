import { coreName, hintFromName, releaseFormOf, type ReleaseForm } from "./labelNames";

// data/drugs.json: formulation facts precomputed by scripts/build-drugs.ts from
// FDA labels, one record per (ingredients, NDC dosage form). Every non-null
// fact has a short verbatim label quote in `evidence`; unsupported facts are null.

export type Mechanism = "immediate" | "extended" | "delayed_enteric" | "liquid" | "other";
export type Evidence = { quote: string; section: string };

export const FACT_FIELDS = [
  "releaseMechanism",
  "entericCoated",
  "containsSorbitol",
  "otherSugarAlcohols",
  "doNotCrushStatement",
  "absorptionSiteStatement",
  "bioavailabilityNote",
] as const;
export const META_FIELDS = ["genericName", "brandNames", "dosageForm"] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export type DrugRecord = {
  id: string;
  sourceName: string;
  genericName: string;
  brandNames: string[];
  // Other brand names on NDC listings with the same ingredients and form; lookup only, not label facts.
  aliases: string[];
  dosageForm: string;
  releaseMechanism: Mechanism | null;
  entericCoated: boolean | null;
  containsSorbitol: boolean | null;
  otherSugarAlcohols: string[] | null;
  doNotCrushStatement: string | null;
  absorptionSiteStatement: string | null;
  bioavailabilityNote: string | null;
  labelSectionCitations: Record<string, string>;
  evidence: Record<string, Evidence>;
  label: { splId: string; setId: string | null; manufacturer: string | null; effectiveTime: string | null };
  absentSections: string[];
  spotCheck: boolean;
};

export type DrugTable = {
  generatedAt: string;
  model: string;
  source: { list: string; url: string; drugs: number };
  recordCount: number;
  records: DrugRecord[];
};

export type TableMatch = "exact" | "alias" | "fuzzy";

const MECHANISM_FORM: Record<Mechanism, ReleaseForm> = {
  immediate: "immediate-release",
  extended: "extended-release",
  delayed_enteric: "delayed-release",
  liquid: "liquid",
  other: "unknown",
};

// The NDC dosage form is the deterministic signal; the extracted mechanism only fills gaps.
export function recordReleaseForm(r: DrugRecord): ReleaseForm {
  const fromForm = releaseFormOf(r.dosageForm);
  if (fromForm !== "unknown") return fromForm;
  return r.releaseMechanism ? MECHANISM_FORM[r.releaseMechanism] : "unknown";
}

// Counter-ions and pack words that do not change which product is meant.
// The first word is never stripped ("potassium chloride" stays itself).
const SALT_WORDS = new Set(
  "hydrochloride hcl sodium potassium calcium magnesium succinate tartrate besylate maleate mesylate citrate sulfate fumarate bromide hydrobromide acetate phosphate hyclate monohydrate dihydrate trihydrate hemihydrate bitartrate dihydrochloride propionate valerate furoate disodium anhydrous".split(" "),
);
const FILLER_WORDS = new Set(
  "extra strength regular maximum children childrens child infant infants junior adult adults arthritis caplet caplets gelcap gelcaps softgel softgels pain relief brand generic usp".split(" "),
);

const UNUSUAL_FORM = /DISINTEGRATING|ODT|CHEWABLE|POWDER|GRANULE|BAR|GEL|FILM, SOLUBLE|STRIP|LOZENGE|GUM|SPRINKLE/;

export function baseName(name: string): string {
  const words = coreName(name.replace(/['’]/g, "")).split(" ").filter((w) => w && !FILLER_WORDS.has(w));
  return words.filter((w, i) => i === 0 || !SALT_WORDS.has(w)).join(" ");
}

export function lookupDrug(
  records: DrugRecord[],
  name: string,
  hint: ReleaseForm | null = hintFromName(name),
): { record: DrugRecord; match: "exact" | "alias" } | null {
  const core = coreName(name);
  if (!core) return null;
  const base = baseName(name);
  const isExact = (r: DrugRecord) => coreName(r.genericName) === core;
  // A salt the user named ("metoprolol succinate") must be the record's salt, never a sibling's.
  const salts = core.split(" ").slice(1).filter((w) => SALT_WORDS.has(w));
  const candidates = records.filter(
    (r) =>
      isExact(r) ||
      (!!base &&
        salts.every((w) => coreName(r.genericName).split(" ").includes(w)) &&
        [r.genericName, r.sourceName, ...r.brandNames, ...r.aliases].some((n) => baseName(n) === base)),
  );

  // Never answer across release forms: "ER" must find an extended-release record or nothing.
  const pool = hint ? candidates.filter((r) => recordReleaseForm(r) === hint) : candidates;
  if (!pool.length) return null;

  // A brand names a product; unusual forms only when asked for; then plain
  // immediate-release when no release form was named; then exact over alias.
  // Listings that just repeat the generic name ("Metoprolol Succinate ER") are not a brand.
  const brandHit = (r: DrugRecord) =>
    base !== baseName(r.genericName) && [...r.brandNames, ...r.aliases].some((b) => baseName(b) === base);
  const unusual = (r: DrugRecord) => UNUSUAL_FORM.test(r.dosageForm) && !UNUSUAL_FORM.test(name.toUpperCase());
  const ir = (r: DrugRecord) => !hint && recordReleaseForm(r) === "immediate-release";
  const sorted = [...pool].sort(
    (a, b) =>
      Number(brandHit(b)) - Number(brandHit(a)) ||
      Number(unusual(a)) - Number(unusual(b)) ||
      Number(ir(b)) - Number(ir(a)) ||
      Number(isExact(b)) - Number(isExact(a)) ||
      a.dosageForm.length - b.dosageForm.length ||
      a.id.localeCompare(b.id),
  );
  return { record: sorted[0], match: isExact(sorted[0]) ? "exact" : "alias" };
}
