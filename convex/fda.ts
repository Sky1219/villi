import { v } from "convex/values";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

// Sections probed in order. Modern PLR labels lack inactive_ingredient and
// warnings; older OTC labels lack the PLR keys. Absence is reported, never hidden.
export const LABEL_SECTIONS = [
  "dosage_forms_and_strengths",
  "description",
  "clinical_pharmacology",
  "pharmacokinetics",
  "mechanism_of_action",
  "how_supplied",
  "dosage_and_administration",
  "inactive_ingredient",
  "spl_product_data_elements",
  "boxed_warning",
  "warnings_and_cautions",
  "warnings",
  "spl_unclassified_section",
] as const;

const SECTION_CAP = 4000;
const FOUND_TTL = 30 * 86_400_000;
const MISSING_TTL = 86_400_000;

export type ReleaseForm = "extended-release" | "delayed-release" | "liquid" | "immediate-release" | "unknown";

export type LabelResult = {
  found: boolean;
  queryKey: string;
  brandName: string | null;
  genericName: string | null;
  manufacturer: string | null;
  effectiveTime: string | null;
  dosageForms: string[];
  releaseForm: ReleaseForm;
  otherReleaseFormsOnMarket: ReleaseForm[];
  sections: Record<string, string>;
  absentSections: string[];
  flags: { flag: string; section: string; evidence: string }[];
  fromCache: boolean;
  error: string | null;
};

export function releaseFormOf(dosageForm: string): ReleaseForm {
  const f = dosageForm.toUpperCase();
  if (/EXTENDED RELEASE|EXTENDED-RELEASE|SUSTAINED|CONTROLLED/.test(f)) return "extended-release";
  if (/DELAYED RELEASE|DELAYED-RELEASE|ENTERIC/.test(f)) return "delayed-release";
  if (/^(TABLET|CAPSULE)/.test(f)) return "immediate-release";
  if (/SOLUTION|SUSPENSION|SYRUP|ELIXIR|LIQUID|DROPS/.test(f)) return "liquid";
  if (/POWDER|GRANULE/.test(f)) return "immediate-release";
  return "unknown";
}

function hintFromName(name: string): ReleaseForm | null {
  const n = ` ${name.toLowerCase()} `;
  if (/\b(er|xl|xr|sr|cr|la|extended|sustained|controlled|24 ?hr?)\b/.test(n)) return "extended-release";
  if (/\b(dr|ec|delayed|enteric)\b/.test(n)) return "delayed-release";
  if (/\b(solution|liquid|syrup|suspension|elixir|oral solution)\b/.test(n)) return "liquid";
  return null;
}

// "Metoprolol succinate ER 50 mg tablets" -> "metoprolol succinate"
export function coreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|%|units?)(\s*\/\s*\d*\s*(ml|l))?/g, " ")
    .replace(
      /\b(er|xl|xr|sr|cr|la|dr|ec|extended|sustained|controlled|delayed|enteric|release|coated|tablets?|caps?|capsules?|oral|solution|liquid|syrup|suspension|elixir|hr|24)\b/g,
      " ",
    )
    .replace(/[^a-z0-9\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeFlags(sections: Record<string, string>, releaseForm: ReleaseForm) {
  const flags: LabelResult["flags"] = [];
  if (releaseForm === "extended-release" || releaseForm === "delayed-release") {
    flags.push({ flag: releaseForm, section: "dosage_form", evidence: "NDC dosage form" });
  }
  for (const key of ["spl_product_data_elements", "inactive_ingredient", "description"]) {
    const text = sections[key];
    if (!text) continue;
    const m = text.match(/\b(sorbitol|xylitol|mannitol|maltitol|isomalt|erythritol|lactitol)\b/i);
    if (m) {
      flags.push({ flag: "sugar-alcohol", section: key, evidence: m[1].toLowerCase() });
      break;
    }
  }
  const da = sections.dosage_and_administration ?? "";
  const sw = da.match(/[^.]*\b(swallow(ed)? whole|do not (crush|chew|split|break)|not be (crushed|chewed|split))[^.]*\./i);
  if (sw) flags.push({ flag: "swallow-whole", section: "dosage_and_administration", evidence: sw[0].trim().slice(0, 240) });
  return flags;
}

type OpenFdaLabel = {
  id?: string;
  set_id?: string;
  effective_time?: string;
  openfda?: Record<string, string[] | boolean[] | undefined>;
  [key: string]: unknown;
};

async function getJson(url: string): Promise<{ status: number; body: { results?: unknown[] } | null }> {
  const key = env.OPENFDA_API_KEY;
  const res = await fetch(key ? `${url}&api_key=${encodeURIComponent(key)}` : url);
  if (res.status === 404) return { status: 404, body: null };
  if (!res.ok) return { status: res.status, body: null };
  return { status: 200, body: (await res.json()) as { results?: unknown[] } };
}

const q = (s: string) => encodeURIComponent(`"${s}"`);

// The product's own front panel and forms list; description prose often mentions sibling forms.
function labelText(l: OpenFdaLabel): string {
  return [l.package_label_principal_display_panel, l.dosage_forms_and_strengths, l.openfda?.brand_name]
    .flat()
    .filter((x): x is string => typeof x === "string")
    .join(" ")
    .slice(0, 6000)
    .toUpperCase();
}

function rank(
  labels: OpenFdaLabel[],
  core: string,
  hint: ReleaseForm | null,
  name: string,
  formBySplId: Map<string, ReleaseForm>,
): OpenFdaLabel[] {
  // No release wording in the name: prefer the plain immediate-release product.
  const desired = hint ?? "immediate-release";
  const strengths = Array.from(name.toUpperCase().matchAll(/(\d+(?:\.\d+)?)\s?(MG|MCG|G)/g), (m) => `${m[1]} ${m[2]}`);
  const wantsChild = /child|infant|pediatric/i.test(name);
  const hintWords: Record<string, RegExp> = {
    "extended-release": /EXTENDED[- ]RELEASE|SUSTAINED|\bER\b|\bXL\b/,
    "delayed-release": /DELAYED[- ]RELEASE|ENTERIC/,
    liquid: /SOLUTION|LIQUID|SYRUP|SUSPENSION/,
  };
  const score = (l: OpenFdaLabel) => {
    let s = 0;
    const text = labelText(l);
    const brand = ((l.openfda?.brand_name as string[] | undefined)?.[0] ?? "").toLowerCase();
    const generic = ((l.openfda?.generic_name as string[] | undefined)?.[0] ?? "").toLowerCase();
    const ndcForm = l.id ? formBySplId.get(l.id) : undefined;
    if (ndcForm) s += ndcForm === desired ? 60 : -60;
    if (hint && hint !== "immediate-release" && hintWords[hint]?.test(text)) s += 100;
    if (!hint && !/EXTENDED[- ]RELEASE|DELAYED[- ]RELEASE/.test(text)) s += 20;
    if (!hint && !/ORAL SOLUTION|SUSPENSION|SYRUP|LIQUID/.test(text)) s += 15;
    if (strengths.some((st) => text.includes(st))) s += 15;
    if (!wantsChild && /CHILD|INFANT|PEDIATRIC/.test(text + brand.toUpperCase())) s -= 40;
    if (brand.startsWith(core) || generic.startsWith(core)) s += 30;
    if (generic.split(",").length === 1) s += 10; // single-ingredient products first
    if ((l.openfda?.is_original_packager as boolean[] | undefined)?.[0] === true) s += 5;
    s += Number(l.effective_time ?? 0) / 1e9; // newest as tiebreak
    return s;
  };
  return [...labels].sort((a, b) => score(b) - score(a));
}

async function fetchFromOpenFda(name: string): Promise<Omit<LabelResult, "fromCache" | "queryKey">> {
  const core = coreName(name);
  const hint = hintFromName(name);
  const empty = {
    found: false,
    brandName: null,
    genericName: null,
    manufacturer: null,
    effectiveTime: null,
    dosageForms: [],
    releaseForm: "unknown" as ReleaseForm,
    otherReleaseFormsOnMarket: [] as ReleaseForm[],
    sections: {},
    absentSections: [...LABEL_SECTIONS],
    flags: [],
    error: null,
  };
  if (!core) return empty;

  const base = "https://api.fda.gov/drug";
  const [byBrand, byGeneric, byExact, ndcAll] = await Promise.all([
    getJson(`${base}/label.json?search=openfda.brand_name:${q(core)}&limit=25`),
    getJson(`${base}/label.json?search=openfda.generic_name:${q(core)}&limit=25`),
    getJson(`${base}/label.json?search=openfda.generic_name.exact:${q(core.toUpperCase())}&limit=50`),
    getJson(`${base}/ndc.json?search=generic_name:${q(core)}+brand_name:${q(core)}&limit=100`),
  ]);
  for (const r of [byBrand, byGeneric, byExact]) {
    if (r.status === 429) return { ...empty, error: "openFDA rate limit" };
    if (r.status !== 200 && r.status !== 404) return { ...empty, error: `openFDA error ${r.status}` };
  }
  const labels = [...((byBrand.body?.results ?? []) as OpenFdaLabel[]), ...((byGeneric.body?.results ?? []) as OpenFdaLabel[]), ...((byExact.body?.results ?? []) as OpenFdaLabel[])].filter(
    (l) => ((l.openfda?.route as string[] | undefined) ?? ["ORAL"]).includes("ORAL"),
  );
  if (labels.length === 0) return empty;

  const formBySplId = new Map<string, ReleaseForm>();
  for (const r of (ndcAll.body?.results ?? []) as { spl_id?: string; dosage_form?: string }[]) {
    if (r.spl_id && r.dosage_form) formBySplId.set(r.spl_id, releaseFormOf(r.dosage_form));
  }
  const label = rank(labels, core, hint, name, formBySplId)[0];
  // The chosen label's own NDC listing gives its dosage form deterministically.
  const ndcOwn = label.id ? await getJson(`${base}/ndc.json?search=spl_id:${q(label.id)}&limit=5`) : null;
  const ownForms = Array.from(
    new Set(((ndcOwn?.body?.results ?? []) as { dosage_form?: string }[]).map((r) => r.dosage_form).filter((x): x is string => !!x)),
  );
  const marketForms = Array.from(
    new Set(((ndcAll.body?.results ?? []) as { dosage_form?: string }[]).map((r) => r.dosage_form).filter((x): x is string => !!x)),
  );
  let releaseForm: ReleaseForm = ownForms.length ? releaseFormOf(ownForms[0]) : "unknown";
  if (releaseForm === "unknown") {
    // Fall back to the label's own dosage-forms text.
    const t = labelText(label);
    releaseForm = /EXTENDED[- ]RELEASE/.test(t)
      ? "extended-release"
      : /DELAYED[- ]RELEASE|ENTERIC/.test(t)
        ? "delayed-release"
        : hint ?? "unknown";
  }

  const sections: Record<string, string> = {};
  const absentSections: string[] = [];
  for (const key of LABEL_SECTIONS) {
    const val = label[key];
    const text = Array.isArray(val) ? val.filter((x) => typeof x === "string").join("\n") : "";
    if (text.trim()) sections[key] = text.slice(0, SECTION_CAP);
    else absentSections.push(key);
  }
  if (ownForms.length) sections.dosage_form = ownForms.join("; ");
  else absentSections.push("dosage_form");

  const of = label.openfda ?? {};
  return {
    found: true,
    brandName: (of.brand_name as string[] | undefined)?.[0] ?? null,
    genericName: (of.generic_name as string[] | undefined)?.[0] ?? null,
    manufacturer: (of.manufacturer_name as string[] | undefined)?.[0] ?? null,
    effectiveTime: label.effective_time ?? null,
    dosageForms: ownForms,
    releaseForm,
    otherReleaseFormsOnMarket: Array.from(new Set(marketForms.map(releaseFormOf))).filter((f) => f !== releaseForm && f !== "unknown"),
    sections,
    absentSections,
    flags: computeFlags(sections, releaseForm),
    error: null,
  };
}

function fromRow(row: Doc<"fda_label_cache">): LabelResult {
  const releaseForm = row.dosageForms.length ? releaseFormOf(row.dosageForms[0]) : ((row.sections.release_form as ReleaseForm) ?? "unknown");
  const { release_form: _rf, other_forms: other, ...sections } = row.sections;
  return {
    found: row.found,
    queryKey: row.queryKey,
    brandName: row.brandName ?? null,
    genericName: row.genericName ?? null,
    manufacturer: row.manufacturer ?? null,
    effectiveTime: row.effectiveTime ?? null,
    dosageForms: row.dosageForms,
    releaseForm,
    otherReleaseFormsOnMarket: other ? (other.split(",").filter(Boolean) as ReleaseForm[]) : [],
    sections,
    absentSections: row.absentSections,
    flags: computeFlags(sections, releaseForm),
    fromCache: true,
    error: null,
  };
}

export const getCached = internalQuery({
  args: { queryKey: v.string() },
  handler: async (ctx, args) =>
    await ctx.db
      .query("fda_label_cache")
      .withIndex("by_queryKey", (q) => q.eq("queryKey", args.queryKey))
      .unique(),
});

export const putCache = internalMutation({
  args: {
    queryKey: v.string(),
    found: v.boolean(),
    brandName: v.optional(v.string()),
    genericName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    effectiveTime: v.optional(v.string()),
    dosageForms: v.array(v.string()),
    routes: v.array(v.string()),
    sections: v.record(v.string(), v.string()),
    absentSections: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("fda_label_cache")
      .withIndex("by_queryKey", (q) => q.eq("queryKey", args.queryKey))
      .unique();
    const doc = { ...args, fetchedAt: Date.now() };
    if (existing) await ctx.db.replace("fda_label_cache", existing._id, doc);
    else await ctx.db.insert("fda_label_cache", doc);
    return null;
  },
});

export const clearCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    for await (const row of ctx.db.query("fda_label_cache")) await ctx.db.delete("fda_label_cache", row._id);
    return null;
  },
});

export const fetchLabel = internalAction({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<LabelResult> => {
    const queryKey = `${coreName(args.name)}|${hintFromName(args.name) ?? "any"}`;
    const cached: Doc<"fda_label_cache"> | null = await ctx.runQuery(internal.fda.getCached, { queryKey });
    if (cached && Date.now() - cached.fetchedAt < (cached.found ? FOUND_TTL : MISSING_TTL)) {
      return fromRow(cached);
    }
    let fresh: Omit<LabelResult, "fromCache" | "queryKey">;
    try {
      fresh = await fetchFromOpenFda(args.name);
    } catch (e) {
      return { ...(cached ? fromRow(cached) : emptyResult(queryKey)), error: `openFDA unreachable: ${(e as Error).message}` };
    }
    if (fresh.error) return { ...fresh, queryKey, fromCache: false };
    await ctx.runMutation(internal.fda.putCache, {
      queryKey,
      found: fresh.found,
      brandName: fresh.brandName ?? undefined,
      genericName: fresh.genericName ?? undefined,
      manufacturer: fresh.manufacturer ?? undefined,
      effectiveTime: fresh.effectiveTime ?? undefined,
      dosageForms: fresh.dosageForms,
      routes: ["ORAL"],
      sections: { ...fresh.sections, release_form: fresh.releaseForm, other_forms: fresh.otherReleaseFormsOnMarket.join(",") },
      absentSections: fresh.absentSections,
    });
    return { ...fresh, queryKey, fromCache: false };
  },
});

function emptyResult(queryKey: string): LabelResult {
  return {
    found: false,
    queryKey,
    brandName: null,
    genericName: null,
    manufacturer: null,
    effectiveTime: null,
    dosageForms: [],
    releaseForm: "unknown",
    otherReleaseFormsOnMarket: [],
    sections: {},
    absentSections: [...LABEL_SECTIONS],
    flags: [],
    fromCache: false,
    error: null,
  };
}
