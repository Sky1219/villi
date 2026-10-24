// npm run build:drugs [-- --limit N] [-- --only "Metoprolol"] [-- --fresh]
//
// Builds data/drugs.json: formulation facts for the ClinCalc top 300, one record
// per (ingredients, NDC dosage form), from FDA labels. Claude (fast model)
// extracts each fact with a verbatim quote; code checks the quote is really in
// the named section; a second Claude call verifies each fact against its quote
// and section. Anything unsupported becomes null and is logged to
// data/drugs_review.log. Raw openFDA JSON is cached in data/labels_raw/.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { releaseFormOf } from "../convex/lib/labelNames";
import { FACT_FIELDS, lookupDrug, type DrugRecord, type DrugTable, type Evidence, type FactField, type Mechanism } from "../convex/lib/drugTable";

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "labels_raw");
const LIST_URL = "https://clincalc.com/DrugStats/Top300Drugs.aspx";
const PROMPT_VERSION = 2;
const MAX_STATEMENT_WORDS = 40;
const SECTION_CAP = 6000;
const MAX_QUOTE_WORDS = 14;
const CONCURRENCY = 10;

// The demo profiles' meds must be in the table even if the list omits them (acetaminophen is OTC).
const DEMO_EXTRAS = ["Metoprolol", "Pantoprazole", "Acetaminophen", "Loperamide", "Ondansetron", "Omeprazole"];
const DEMO_ITEMS = ["Metoprolol succinate ER 50 mg", "Pantoprazole sodium DR 40 mg", "Tylenol Extra Strength liquid"];

const SECTIONS = [
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
  "information_for_patients",
  "spl_patient_package_insert",
  "instructions_for_use",
];

const args = process.argv.slice(2);
const argVal = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const LIMIT = Number(argVal("--limit") ?? Infinity);
const ONLY = argVal("--only")?.toLowerCase();
const FRESH = args.includes("--fresh");

// Keys come from the shell, else from the Convex deployment env (dev, then prod). Never printed.
function secret(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const flag of ["", " --prod"]) {
    try {
      const v = execSync(`npx convex env get ${name}${flag}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (v && !/\s/.test(v)) return v;
    } catch {
      // not set on that deployment
    }
  }
  return undefined;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.;,:]+$/, "")
    .trim();

async function readJson<T>(file: string): Promise<T | null> {
  return existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : null;
}
async function writeJson(file: string, data: unknown, indent = 0) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, indent) + "\n");
}

// ---------- review log ----------

const logLines: string[] = [];
function review(recordId: string, field: string, stage: string, reason: string, value?: unknown, ev?: Evidence | null) {
  const cell = (x: unknown) => (x === undefined ? "" : String(typeof x === "string" ? x : JSON.stringify(x)).replace(/[\t\n]+/g, " "));
  logLines.push([recordId, field, stage, reason, cell(value), cell(ev?.quote), cell(ev?.section)].join("\t"));
}

// ---------- source list ----------

async function sourceList(): Promise<{ names: string[]; url: string; list: string }> {
  const cacheFile = path.join(DATA, "top300.json");
  let cached = await readJson<{ list: string; url: string; fetchedAt: string; names: string[] }>(cacheFile);
  if (!cached || FRESH) {
    try {
      const html = await (await fetch(LIST_URL, { headers: { "User-Agent": "Mozilla/5.0 (villi build-drugs)" } })).text();
      const names = Array.from(html.matchAll(/href="Drugs\/[^"]+">([^<]+)</g), (m) => m[1].replace(/&amp;/g, "&").trim());
      const year = html.match(/Top 300 of (\d{4})/)?.[1] ?? "?";
      if (names.length >= 250) {
        cached = { list: `ClinCalc DrugStats Top 300 of ${year}`, url: LIST_URL, fetchedAt: new Date().toISOString(), names };
        await writeJson(cacheFile, cached, 2);
      }
    } catch (e) {
      console.warn(`could not fetch the source list (${(e as Error).message}); using the cached copy`);
    }
  }
  if (!cached) throw new Error("no source list: fetch failed and data/top300.json does not exist");
  const names = [...cached.names];
  for (const extra of DEMO_EXTRAS) if (!names.some((n) => n.toLowerCase() === extra.toLowerCase())) names.push(extra);
  return { names, url: cached.url, list: cached.list };
}

// ---------- openFDA ----------

let openFdaKey: string | undefined;
let lastRequest = 0;
let requests = 0;
async function getJson(url: string): Promise<{ results?: unknown[]; meta?: { results?: { total?: number } } } | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    // 240 requests/min per key.
    const wait = lastRequest + 270 - Date.now();
    lastRequest = Math.max(Date.now(), lastRequest + 270);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    requests++;
    const res = await fetch(openFdaKey ? `${url}&api_key=${encodeURIComponent(openFdaKey)}` : url);
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as { results?: unknown[] };
    if (res.status !== 429 && res.status < 500) throw new Error(`openFDA ${res.status} for ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw new Error(`openFDA kept failing for ${url}`);
}

type NdcProduct = {
  product_ndc: string;
  generic_name?: string;
  brand_name?: string;
  active_ingredients?: { name: string; strength?: string }[];
  dosage_form?: string;
  route?: string[];
  spl_id?: string;
  spl_set_id?: string;
  marketing_category?: string;
  labeler_name?: string;
  finished?: boolean;
  product_type?: string;
  marketing_start_date?: string;
};

async function ndcProducts(name: string, field: "generic_name" | "brand_name"): Promise<NdcProduct[]> {
  const file = path.join(RAW, "ndc", `${field}-${slug(name)}.json`);
  const cached = await readJson<NdcProduct[]>(file);
  if (cached) return cached;
  const search = name
    .split(";")
    .map((c) => `${field}:${encodeURIComponent(`"${c.trim()}"`)}`)
    .join("+AND+");
  const out: NdcProduct[] = [];
  for (let skip = 0; skip < 3000; skip += 1000) {
    const page = await getJson(`https://api.fda.gov/drug/ndc.json?search=${search}&limit=1000&skip=${skip}`);
    const rows = (page?.results ?? []) as (NdcProduct & { openfda?: { spl_set_id?: string[] } })[];
    for (const r of rows) {
      out.push({
        product_ndc: r.product_ndc,
        generic_name: r.generic_name,
        brand_name: r.brand_name,
        active_ingredients: r.active_ingredients,
        dosage_form: r.dosage_form,
        route: r.route,
        spl_id: r.spl_id,
        spl_set_id: r.openfda?.spl_set_id?.[0],
        marketing_category: r.marketing_category,
        labeler_name: r.labeler_name,
        finished: r.finished,
        product_type: r.product_type,
        marketing_start_date: r.marketing_start_date,
      });
    }
    if (rows.length < 1000 || out.length >= (page?.meta?.results?.total ?? 0)) break;
  }
  await writeJson(file, out);
  return out;
}

const tokens = (s: string) => s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

// Single products whose ingredients are exactly the listed components, taken by mouth.
function matchesComponents(p: NdcProduct, components: string[]): boolean {
  const ings = p.active_ingredients ?? [];
  if (p.finished === false || !p.dosage_form || !p.spl_id) return false;
  if (!(p.route ?? []).includes("ORAL")) return false;
  if (!(p.product_type ?? "").startsWith("HUMAN")) return false;
  if (ings.length !== components.length) return false;
  return components.every((c) => ings.some((i) => tokens(c).every((t) => tokens(i.name).includes(t))));
}

type Group = { genericKey: string; dosageForm: string; products: NdcProduct[] };

function groupProducts(products: NdcProduct[]): Group[] {
  const groups = new Map<string, Group>();
  for (const p of products) {
    const genericKey = (p.active_ingredients ?? []).map((i) => i.name.toLowerCase().trim()).sort().join(" and ");
    const key = `${genericKey}|${p.dosage_form}`;
    const g = groups.get(key) ?? { genericKey, dosageForm: p.dosage_form!, products: [] };
    g.products.push(p);
    groups.set(key, g);
  }
  return [...groups.values()];
}

type OpenFdaLabel = { id?: string; set_id?: string; effective_time?: string; openfda?: Record<string, string[] | undefined>; [k: string]: unknown };

async function labelFor(p: NdcProduct): Promise<OpenFdaLabel | null> {
  const file = path.join(RAW, `${p.spl_id}.json`);
  const cached = await readJson<OpenFdaLabel | { missing: true }>(file);
  if (cached) return "missing" in cached ? null : cached;
  let res = await getJson(`https://api.fda.gov/drug/label.json?search=id:${encodeURIComponent(`"${p.spl_id}"`)}&limit=1`);
  if (!res?.results?.length && p.spl_set_id) {
    res = await getJson(`https://api.fda.gov/drug/label.json?search=set_id:${encodeURIComponent(`"${p.spl_set_id}"`)}&limit=1`);
  }
  const label = (res?.results?.[0] as OpenFdaLabel | undefined) ?? null;
  await writeJson(file, label ?? { missing: true });
  return label;
}

// The originator's label first, then the newest listing.
const CATEGORY_RANK: Record<string, number> = { NDA: 0, BLA: 0, "NDA AUTHORIZED GENERIC": 1, "OTC MONOGRAPH DRUG": 2, "OTC MONOGRAPH FINAL": 2, ANDA: 3 };
function rankProducts(products: NdcProduct[]): NdcProduct[] {
  const seen = new Set<string>();
  return [...products]
    .sort(
      (a, b) =>
        (CATEGORY_RANK[a.marketing_category ?? ""] ?? 4) - (CATEGORY_RANK[b.marketing_category ?? ""] ?? 4) ||
        (b.marketing_start_date ?? "").localeCompare(a.marketing_start_date ?? ""),
    )
    .filter((p) => !seen.has(p.spl_id!) && seen.add(p.spl_id!));
}

function labelSections(label: OpenFdaLabel, dosageForm: string) {
  const sections: Record<string, string> = { dosage_form: dosageForm };
  const absent: string[] = [];
  for (const key of SECTIONS) {
    const val = label[key];
    const text = Array.isArray(val) ? val.filter((x) => typeof x === "string").join("\n") : "";
    if (text.trim()) sections[key] = text.replace(/\s+/g, " ").trim().slice(0, SECTION_CAP);
    else absent.push(key);
  }
  return { sections, absent };
}

// ---------- Claude ----------

const EvidenceSchema = z.object({ quote: z.string(), section: z.string() }).nullable();
const fact = <T extends z.ZodTypeAny>(value: T) => z.object({ value: value.nullable(), evidence: EvidenceSchema });
const ExtractSchema = z.object({
  releaseMechanism: fact(z.enum(["immediate", "extended", "delayed_enteric", "liquid", "other"])),
  entericCoated: fact(z.boolean()),
  containsSorbitol: fact(z.boolean()),
  otherSugarAlcohols: fact(z.array(z.string())),
  doNotCrushStatement: fact(z.string()),
  absorptionSiteStatement: fact(z.string()),
  bioavailabilityNote: fact(z.string()),
});
type Extraction = z.infer<typeof ExtractSchema>;

const VerifySchema = z.object({
  checks: z.array(z.object({ field: z.enum(FACT_FIELDS), supported: z.boolean(), reason: z.string() })),
});
type Verification = z.infer<typeof VerifySchema>;

const EXTRACT_SYSTEM = `You extract formulation facts from one FDA drug label for an app about short bowel syndrome. You receive the product's NDC dosage form and label sections as {section_key: text}. The product is the one with that dosage form; ignore other forms the label mentions.

For every field return {value, evidence}. evidence.quote must be copied character for character from ONE section (at most ${MAX_QUOTE_WORDS} words, no ellipses, no edits) and evidence.section must be that section's key exactly. If the label text does not support a value, return value null and evidence null. Never use outside knowledge and never guess.

- releaseMechanism: "immediate" (conventional tablet or capsule; a cosmetic film coat is still immediate), "extended" (extended/sustained/controlled release, ER/XL/SR/24-hour), "delayed_enteric" (delayed-release or enteric-coated), "liquid" (solution, suspension, syrup, elixir), "other" (orally disintegrating, chewable, powder, granules, anything else). The dosage_form section is usually the best quote.
- entericCoated: true only if the text says enteric-coated or describes a coating that delays release until the intestine; false if the dosage_form or description shows this form is not enteric-coated; else null.
- containsSorbitol: true if sorbitol (including "sorbitol solution") is listed as an ingredient, quoting the words that include it; false only if a full ingredient list (spl_product_data_elements, inactive_ingredient or description) is present and sorbitol is not in it, quoting the start of that list; null if no ingredient list.
- otherSugarAlcohols: which of mannitol, xylitol, maltitol, isomalt, erythritol, lactitol are listed as ingredients (lowercase). [] if a full ingredient list is present and none are in it (quote the start of the list); null if no ingredient list.
- doNotCrushStatement: a label instruction not to crush, chew, split, break or open it, or to swallow it whole.
- absorptionSiteStatement: label text saying where in the gut it is released or absorbed (stomach, small intestine, duodenum, colon, a pH threshold).
- bioavailabilityNote: label text stating its oral bioavailability (with the number when given) or how food changes absorption.
For these three statement fields the value is the whole sentence copied verbatim from the section (at most ${MAX_STATEMENT_WORDS} words), and the quote is the part of that sentence (at most ${MAX_QUOTE_WORDS} words) that carries the fact.`;

const DEFINITIONS = EXTRACT_SYSTEM.slice(EXTRACT_SYSTEM.indexOf("- releaseMechanism"));

const VERIFY_SYSTEM = `You check facts extracted from an FDA drug label. For each field you get the extracted value, the quote offered as evidence, the section it came from and that section's text. supported=true only if the quote really is in the section and, read in context, supports exactly this value for a product with the given NDC dosage form. For a false or empty value about ingredients, the section must be a full ingredient list that really lacks the ingredient. If the quote is about a different dosage form, a different product, or needs outside knowledge to reach the value, supported=false. Mapping an NDC dosage form term to the categories below is part of the task, not outside knowledge (e.g. "SOLUTION" is liquid; "TABLET, FILM COATED" with no release wording is immediate; a solution is not enteric-coated). Return one check for every field you were given, with a one-sentence reason.

Field definitions the extractor used:
${DEFINITIONS}`;

let client: Anthropic;
let model = "";

async function callClaude<T>(schema: z.ZodType<T>, system: string, user: unknown): Promise<T | null> {
  const res = await client.messages.parse({
    model,
    max_tokens: 8000,
    system,
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: JSON.stringify(user) }],
  });
  return (res.parsed_output as T | null) ?? null;
}

// ---------- one record ----------

const STATEMENT_FIELDS = new Set<FactField>(["doNotCrushStatement", "absorptionSiteStatement", "bioavailabilityNote"]);
const INGREDIENT_SECTIONS = ["spl_product_data_elements", "inactive_ingredient", "description"];
const SUGAR_ALCOHOLS = ["mannitol", "xylitol", "maltitol", "isomalt", "erythritol", "lactitol"];

type Checked = { values: Partial<Record<FactField, unknown>>; evidence: Partial<Record<FactField, Evidence>> };

// Deterministic gate before the verifier: the quote must be short and really in that section.
function checkQuotes(id: string, ex: Extraction, sections: Record<string, string>, dosageForm: string): Checked {
  const out: Checked = { values: {}, evidence: {} };
  for (const field of FACT_FIELDS) {
    const { value, evidence } = ex[field] as { value: unknown; evidence: Evidence | null };
    if (value === null || value === undefined) continue;
    const fail = (reason: string) => review(id, field, "quote-check", reason, value, evidence);
    if (!evidence) {
      fail("no evidence given");
      continue;
    }
    const text = sections[evidence.section];
    if (!text) {
      fail(`section "${evidence.section}" is not on this label`);
      continue;
    }
    if (words(evidence.quote) > MAX_QUOTE_WORDS) {
      fail(`quote is ${words(evidence.quote)} words`);
      continue;
    }
    if (!norm(text).includes(norm(evidence.quote))) {
      fail("quote not found verbatim in that section");
      continue;
    }
    if (STATEMENT_FIELDS.has(field)) {
      const sv = norm(String(value));
      if (!norm(text).includes(sv) || !sv.includes(norm(evidence.quote)) || words(String(value)) > MAX_STATEMENT_WORDS) {
        fail("statement is not a short verbatim label sentence containing the quote");
        continue;
      }
    }
    if (field === "containsSorbitol" && value === true && !/sorbitol/i.test(evidence.quote)) {
      fail("quote does not mention sorbitol");
      continue;
    }
    if (field === "containsSorbitol" || field === "otherSugarAlcohols") {
      const lists = INGREDIENT_SECTIONS.map((k) => sections[k] ?? "").join(" ").toLowerCase();
      if (field === "containsSorbitol" && value === false && /sorbitol/.test(lists)) {
        fail("label ingredient text mentions sorbitol");
        continue;
      }
      if (field === "otherSugarAlcohols") {
        const listed = (value as string[]).map((s) => s.toLowerCase().trim());
        const found = SUGAR_ALCOHOLS.filter((s) => new RegExp(`\\b${s}\\b`).test(lists));
        if (listed.some((s) => !found.includes(s)) || found.some((s) => !listed.includes(s))) {
          fail(`label ingredient text lists [${found.join(", ")}]`);
          continue;
        }
      }
    }
    if (field === "releaseMechanism") {
      const ndc = releaseFormOf(dosageForm);
      const expected: Partial<Record<string, Mechanism>> = {
        "extended-release": "extended",
        "delayed-release": "delayed_enteric",
        liquid: "liquid",
      };
      const want = expected[ndc];
      if ((want && value !== want) || (ndc === "immediate-release" && (value === "extended" || value === "delayed_enteric"))) {
        fail(`NDC dosage form "${dosageForm}" disagrees`);
        continue;
      }
    }
    out.values[field] = value;
    out.evidence[field] = evidence;
  }
  return out;
}

async function verify(id: string, checked: Checked, sections: Record<string, string>, dosageForm: string): Promise<Checked> {
  const fields = Object.keys(checked.values) as FactField[];
  if (!fields.length) return checked;
  const v: Verification | null = await callClaude(VerifySchema, VERIFY_SYSTEM, {
    dosageForm,
    fields: fields.map((f) => ({
      field: f,
      value: checked.values[f],
      quote: checked.evidence[f]!.quote,
      section: checked.evidence[f]!.section,
      sectionText: sections[checked.evidence[f]!.section],
    })),
  });
  const out: Checked = { values: {}, evidence: {} };
  for (const f of fields) {
    const c = v?.checks.find((x) => x.field === f);
    if (!c || !c.supported) {
      review(id, f, "verifier", c ? `unsupported: ${c.reason}` : v ? "verifier returned no check" : "verifier call failed", checked.values[f], checked.evidence[f]);
      continue;
    }
    out.values[f] = checked.values[f];
    out.evidence[f] = checked.evidence[f];
  }
  return out;
}

type Cached = { promptVersion: number; model: string; extraction: Extraction | null; verified: Checked; log: string[] };

async function buildRecord(sourceName: string, group: Group, label: OpenFdaLabel, chosen: NdcProduct): Promise<DrugRecord> {
  const id = `${slug(group.genericKey)}|${slug(group.dosageForm)}`;
  const { sections, absent } = labelSections(label, group.dosageForm);
  const cacheFile = path.join(RAW, "extract", `${slug(id)}.json`);
  let cached = FRESH ? null : await readJson<Cached>(cacheFile);
  if (cached && (cached.promptVersion !== PROMPT_VERSION || cached.model !== model)) cached = null;
  if (cached) logLines.push(...cached.log);
  else {
    const before = logLines.length;
    const extraction: Extraction | null = await callClaude(ExtractSchema, EXTRACT_SYSTEM, { dosageForm: group.dosageForm, sections });
    let verified: Checked = { values: {}, evidence: {} };
    if (!extraction) review(id, "*", "extract", "extraction call returned nothing; every fact is null");
    else verified = await verify(id, checkQuotes(id, extraction, sections, group.dosageForm), sections, group.dosageForm);
    cached = { promptVersion: PROMPT_VERSION, model, extraction, verified, log: logLines.slice(before) };
    await writeJson(cacheFile, cached, 2);
  }
  const { values, evidence } = cached.verified;

  // Names and dosage form come from the label's own metadata and the NDC listing.
  const of = label.openfda ?? {};
  const genericName = (of.generic_name?.[0] ?? group.genericKey).toLowerCase();
  const brandNames = Array.from(new Set((of.brand_name ?? []).map((b) => b.trim()))).filter((b) => b.toLowerCase() !== genericName);
  const counts = new Map<string, number>();
  for (const p of group.products) {
    const b = p.brand_name?.trim();
    if (b && b.toLowerCase() !== genericName && !brandNames.includes(b)) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const aliases = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b]) => b);

  const allEvidence: Record<string, Evidence> = {
    genericName: { quote: (of.generic_name?.[0] ?? group.genericKey).split(/\s+/).slice(0, MAX_QUOTE_WORDS).join(" "), section: of.generic_name ? "openfda.generic_name" : "ndc.active_ingredients" },
    dosageForm: { quote: group.dosageForm, section: "ndc.dosage_form" },
    ...(brandNames.length ? { brandNames: { quote: brandNames.join(", ").split(/\s+/).slice(0, MAX_QUOTE_WORDS).join(" "), section: "openfda.brand_name" } } : {}),
    ...(evidence as Record<string, Evidence>),
  };
  const val = <T>(f: FactField) => (f in values ? (values[f] as T) : null);
  return {
    id,
    sourceName,
    genericName,
    brandNames,
    aliases,
    dosageForm: group.dosageForm,
    releaseMechanism: val<Mechanism>("releaseMechanism"),
    entericCoated: val<boolean>("entericCoated"),
    containsSorbitol: val<boolean>("containsSorbitol"),
    otherSugarAlcohols: val<string[]>("otherSugarAlcohols"),
    doNotCrushStatement: val<string>("doNotCrushStatement"),
    absorptionSiteStatement: val<string>("absorptionSiteStatement"),
    bioavailabilityNote: val<string>("bioavailabilityNote"),
    labelSectionCitations: Object.fromEntries(Object.entries(allEvidence).map(([f, e]) => [f, e.section])),
    evidence: allEvidence,
    label: {
      splId: label.id ?? chosen.spl_id!,
      setId: label.set_id ?? chosen.spl_set_id ?? null,
      manufacturer: of.manufacturer_name?.[0] ?? chosen.labeler_name ?? null,
      effectiveTime: label.effective_time ?? null,
    },
    absentSections: absent,
    spotCheck: false,
  };
}

async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

// ---------- spot check ----------

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function pickSpotChecks(records: DrugRecord[]): DrugRecord[] {
  const picked = new Map<string, DrugRecord>();
  for (const item of DEMO_ITEMS) {
    const hit = lookupDrug(records, item);
    if (hit) picked.set(hit.record.id, hit.record);
  }
  // Then a fixed pseudo-random spread over release mechanisms and facts that matter most.
  const shuffled = [...records].sort((a, b) => hash(a.id) - hash(b.id));
  const wants: ((r: DrugRecord) => boolean)[] = [
    (r) => r.releaseMechanism === "extended",
    (r) => r.releaseMechanism === "delayed_enteric",
    (r) => r.containsSorbitol === true,
    (r) => !!r.doNotCrushStatement,
    (r) => r.releaseMechanism === "liquid",
    (r) => r.releaseMechanism === "immediate",
    (r) => !!r.absorptionSiteStatement,
    (r) => !!r.bioavailabilityNote,
  ];
  for (let round = 0; picked.size < 20 && round < 5; round++) {
    for (const want of wants) {
      const r = shuffled.find((x) => !picked.has(x.id) && want(x));
      if (r && picked.size < 20) picked.set(r.id, r);
    }
  }
  for (const r of shuffled) if (picked.size < 20 && !picked.has(r.id)) picked.set(r.id, r);
  return [...picked.values()];
}

function spotCheckMarkdown(records: DrugRecord[], generatedAt: string): string {
  const out = [
    `# Drug table spot check (${records.length} records)`,
    "",
    `Generated ${generatedAt} by \`npm run build:drugs\`. These records have \`"spotCheck": true\` in \`data/drugs.json\`.`,
    "For each: open the DailyMed label, find the quote in the named section, and confirm the value. Tick the box when it holds.",
    "",
  ];
  for (const r of records) {
    const link = r.label.setId ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${r.label.setId}` : "(no set id)";
    out.push(`## [ ] ${r.genericName}: ${r.dosageForm}`, "", `\`${r.id}\` · ${r.label.manufacturer ?? "?"} · effective ${r.label.effectiveTime ?? "?"} · ${link}`, "");
    out.push("| Field | Value | Quote | Section |", "|---|---|---|---|");
    for (const f of ["genericName", "brandNames", "dosageForm", ...FACT_FIELDS] as const) {
      const v = r[f as keyof DrugRecord];
      const e = r.evidence[f];
      const cell = (x: unknown) => String(x ?? "").replace(/\|/g, "\\|");
      out.push(`| ${f} | ${cell(v === null ? "null" : JSON.stringify(v))} | ${cell(e?.quote)} | ${cell(e?.section)} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

// Acceptance: every non-null fact has a quote and a section.
function assertEvidence(records: DrugRecord[]) {
  const bad: string[] = [];
  for (const r of records) {
    for (const f of ["genericName", "dosageForm", ...FACT_FIELDS] as const) {
      const v = r[f];
      if (v === null) continue;
      const e = r.evidence[f];
      if (!e?.quote || !e.section || words(e.quote) > MAX_QUOTE_WORDS) bad.push(`${r.id}.${f}`);
    }
    if (r.brandNames.length && !r.evidence.brandNames) bad.push(`${r.id}.brandNames`);
  }
  if (bad.length) throw new Error(`fields without evidence: ${bad.slice(0, 20).join(", ")}${bad.length > 20 ? " ..." : ""}`);
}

// ---------- main ----------

async function main() {
  const anthropicKey = secret("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not found in the shell or the Convex env");
  openFdaKey = secret("OPENFDA_API_KEY");
  if (!openFdaKey) console.warn("no OPENFDA_API_KEY: limited to 1,000 openFDA requests/day from this IP");
  client = new Anthropic({ apiKey: anthropicKey, maxRetries: 4 });
  model = process.env.ANTHROPIC_MODEL_FAST || secret("ANTHROPIC_MODEL_FAST") || "claude-haiku-5-5";

  const source = await sourceList();
  let names = source.names;
  if (ONLY) names = names.filter((n) => n.toLowerCase().includes(ONLY));
  names = names.slice(0, LIMIT);
  console.log(`${names.length} drugs from ${source.list}; model ${model}`);

  type Job = { sourceName: string; group: Group; label: OpenFdaLabel; chosen: NdcProduct };
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const [i, name] of names.entries()) {
    const components = name.split(";").map((c) => c.trim());
    let products = (await ndcProducts(name, "generic_name")).filter((p) => matchesComponents(p, components));
    if (!products.length) {
      const byBrand = await ndcProducts(name, "brand_name");
      products = byBrand.filter((p) => p.finished !== false && p.dosage_form && p.spl_id && (p.route ?? []).includes("ORAL"));
    }
    if (!products.length) {
      review(`source:${name}`, "*", "skip", "no single-product oral NDC listing (not taken by mouth, or a mixture the list names differently)");
      continue;
    }
    for (const group of groupProducts(products)) {
      const id = `${slug(group.genericKey)}|${slug(group.dosageForm)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      let label: OpenFdaLabel | null = null;
      let chosen: NdcProduct | null = null;
      for (const p of rankProducts(group.products).slice(0, 3)) {
        label = await labelFor(p);
        if (label) {
          chosen = p;
          break;
        }
      }
      if (!label || !chosen) {
        review(id, "*", "skip", "no FDA label found for any listing with this dosage form");
        continue;
      }
      // Repackager listings are sometimes miscoded; the label must name the same ingredients.
      const labelGeneric = label.openfda?.generic_name?.[0];
      if (labelGeneric && !tokens(group.genericKey).every((t) => tokens(labelGeneric).includes(t))) {
        review(id, "*", "skip", `NDC listing says ${group.genericKey} but its label is for ${labelGeneric.toLowerCase()}`);
        continue;
      }
      jobs.push({ sourceName: name, group, label, chosen });
    }
    if ((i + 1) % 25 === 0) console.log(`  listings: ${i + 1}/${names.length} drugs, ${jobs.length} forms, ${requests} openFDA requests`);
  }
  console.log(`${jobs.length} records to extract`);

  const records: DrugRecord[] = [];
  let done = 0;
  await pool(jobs, CONCURRENCY, async (job) => {
    try {
      records.push(await buildRecord(job.sourceName, job.group, job.label, job.chosen));
    } catch (e) {
      review(`${slug(job.group.genericKey)}|${slug(job.group.dosageForm)}`, "*", "error", (e as Error).message.slice(0, 200));
    }
    if (++done % 25 === 0) console.log(`  extracted ${done}/${jobs.length}`);
  });
  records.sort((a, b) => a.id.localeCompare(b.id));

  const generatedAt = new Date().toISOString();
  const spot = pickSpotChecks(records);
  for (const r of spot) r.spotCheck = true;
  assertEvidence(records);

  const table: DrugTable = {
    generatedAt,
    model,
    source: { list: source.list, url: source.url, drugs: names.length },
    recordCount: records.length,
    records,
  };
  await writeJson(path.join(DATA, "drugs.json"), table, 1);
  await writeFile(path.join(DATA, "drugs_spotcheck.md"), spotCheckMarkdown(spot, generatedAt));

  logLines.sort();
  const header = [
    `# drugs_review.log: generated ${generatedAt} by npm run build:drugs (${records.length} records, model ${model})`,
    "# Each line is a fact that was dropped to null, or a drug/form that was skipped.",
    "# stage: quote-check = code found the quote missing, too long or contradicted; verifier = second Claude pass said unsupported; skip/extract/error = no record or no facts.",
    "# record\tfield\tstage\treason\tvalue\tquote\tsection",
  ];
  await writeFile(path.join(DATA, "drugs_review.log"), [...header, ...logLines].join("\n") + "\n");

  const nonNull = (f: FactField) => records.filter((r) => r[f] !== null).length;
  console.log(`wrote data/drugs.json: ${records.length} records, ${openFdaKey ? "" : "no key, "}${requests} openFDA requests`);
  for (const f of FACT_FIELDS) console.log(`  ${f}: ${nonNull(f)} non-null`);
  console.log(`review log: ${logLines.length} lines; spot check: data/drugs_spotcheck.md (${spot.length} records)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
