/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { reviewMed, reviewQuestion, type MedReviewInput } from "./lib/medReview";
import { anatomyKeyOf, anatomyShort, scopeTagsFor, type Anatomy } from "./lib/anatomy";
import { labelKeyFor } from "./fda";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const COLO: Anatomy = { colonInContinuity: true, stomaType: "colostomy", bowelLengthBand: ">200cm" };

const LIST: Record<string, Omit<MedReviewInput, "scopeTags">> = {
  metoprolol: {
    name: "Metoprolol succinate ER 50 mg",
    dosageForm: "TABLET, FILM COATED, EXTENDED RELEASE",
    label: { found: true, sections: { dosage_form: "TABLET, FILM COATED, EXTENDED RELEASE", dosage_and_administration: "Swallow tablets whole. Do not crush or chew the tablets." } },
  },
  pantoprazole: {
    name: "Pantoprazole sodium DR 40 mg",
    dosageForm: "TABLET, DELAYED RELEASE",
    label: { found: true, sections: { dosage_form: "TABLET, DELAYED RELEASE", description: "Pantoprazole sodium delayed-release tablets." } },
  },
  liquid: {
    name: "Tylenol Extra Strength liquid",
    dosageForm: "SUSPENSION",
    label: { found: true, sections: { dosage_form: "SUSPENSION", inactive_ingredient: "anhydrous citric acid, flavors, sorbitol solution, sucralose, water" } },
  },
  ondansetron: {
    name: "Ondansetron 4 mg",
    dosageForm: "TABLET, FILM COATED",
    label: { found: true, sections: { dosage_form: "TABLET, FILM COATED", dosage_and_administration: "Take one tablet by mouth." } },
  },
  unchecked: { name: "Newmed 10 mg", dosageForm: null, label: null },
  unlisted: { name: "Zorblatrin 20 mg", dosageForm: null, label: { found: false, sections: {} } },
};

const review = (key: keyof typeof LIST, a: Anatomy) => reviewMed({ ...LIST[key], scopeTags: scopeTagsFor(a) });
const chunkIds = (r: ReturnType<typeof review>, kind: string) =>
  r.flags.find((f) => f.kind === kind)?.citations.filter((c) => c.key.startsWith("G:")).map((c) => c.key.slice(2)) ?? null;

describe("medicine list review", () => {
  it("flags release forms, sugar alcohols and swallow-whole with the mapped chunks for an end-jejunostomy", () => {
    const m = review("metoprolol", JEJ);
    expect(m.state).toBe("flagged");
    expect(chunkIds(m, "extended-release")).toEqual([
      "aga-sbs#medications-release-forms",
      "pg139#extended-release-avoid",
      "sood-2013#formulation",
      "sood-2013#colon-slow-release",
    ]);
    const sw = m.flags.find((f) => f.kind === "swallow-whole")!;
    expect(sw.citations[0]).toMatchObject({ key: "L:dosage_and_administration" });
    expect(sw.text).toContain("Swallow tablets whole");

    const p = review("pantoprazole", JEJ);
    expect(chunkIds(p, "delayed-release")).toEqual(["pg139#ppi", "sood-2013#ppi", "aga-sbs#acid-suppression"]);
    expect(p.flags[0].text).toMatch(/acid-suppressing/);
    // PPIs read with the nuance, never "avoid".
    expect(JSON.stringify(p.flags)).not.toMatch(/\bavoid/i);

    const l = review("liquid", JEJ);
    expect(l.flags[0]).toMatchObject({ kind: "sugar-alcohol" });
    expect(l.flags[0].text).toBe("The label lists sorbitol among its ingredients, in a liquid medicine.");
    expect(chunkIds(l, "sugar-alcohol")).toEqual(["sood-2013#liquid-excipients", "pg139#sugar-alcohols"]);
  });

  it("anatomy scope removes flags that don't apply (colostomy)", () => {
    const m = review("metoprolol", COLO);
    expect(m.flags.map((f) => f.kind)).toEqual(["swallow-whole"]);
    expect(review("pantoprazole", COLO).state).toBe("nothing-found");
    expect(chunkIds(review("liquid", COLO), "sugar-alcohol")).toEqual(["sood-2013#liquid-excipients"]);
  });

  it("says nothing found only after reading the label, and lists the sections it read", () => {
    const o = review("ondansetron", JEJ);
    expect(o).toMatchObject({ state: "nothing-found", flags: [] });
    expect(o.summary).toBe("Label sections checked: dosage form (NDC), dosage and administration.");
    expect(review("unchecked", JEJ)).toMatchObject({ state: "cant-tell", summary: "Label not checked yet." });
    expect(review("unlisted", JEJ).state).toBe("cant-tell");
    expect(review("unlisted", JEJ).summary).toMatch(/No FDA label found/);
  });

  it("the sheet question names the anatomy and the medicine, never a dose", () => {
    const q = reviewQuestion("Metoprolol succinate ER 50 mg", anatomyShort(JEJ));
    expect(q).toBe(
      "With an end-jejunostomy (no colon) and under 100 cm of small bowel, is Metoprolol succinate ER the best form for absorption, or is there another form we should discuss?",
    );
    expect(q).not.toMatch(/\d+\s?mg/);
  });

  it("meds.review reads the cached label; addFromReview adds the fixed question once", async () => {
    const t = convexTest(schema, modules);
    const anonId = "overnight-medreview-00000000001";
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        anonId,
        role: "caregiver",
        caresFor: "parent",
        anatomy: JEJ,
        anatomyKey: anatomyKeyOf(JEJ),
        language: "en",
        clinicianDemoVerified: false,
        synthetic: false,
        createdAt: 0,
      });
      for (const key of ["metoprolol", "unchecked"] as const) {
        const m = LIST[key];
        await ctx.db.insert("meds", { profileId, name: m.name, addedAt: 0 });
        if (m.label) {
          await ctx.db.insert("fda_label_cache", {
            queryKey: labelKeyFor(m.name),
            found: m.label.found,
            dosageForms: m.dosageForm ? [m.dosageForm] : [],
            routes: ["ORAL"],
            sections: m.label.sections,
            absentSections: [],
            fetchedAt: 0,
          });
        }
      }
    });
    const rows = await t.query(api.meds.review, { anonId });
    expect(rows.map((r) => r.state)).toEqual(["flagged", "cant-tell"]);
    await t.mutation(api.questions.addFromReview, { anonId, medId: rows[0]._id });
    await t.mutation(api.questions.addFromReview, { anonId, medId: rows[0]._id });
    const qs = await t.query(api.questions.listMine, { anonId });
    expect(qs).toHaveLength(1);
    expect(qs[0].text).toMatch(/^With an end-jejunostomy .* is Metoprolol succinate ER the best form/);
    const sheet = await t.query(api.sheet.get, { anonId });
    expect(sheet.meds[0].flags[0].citation).toBe("G:aga-sbs#medications-release-forms");
  });
});

describe("label quotes", () => {
  it("drop section numbers and table headers so the quote starts with the sentence", async () => {
    const { labelSentence } = await import("./fda");
    expect(labelSentence("2.4 Administration Metoprolol succinate extended-release tablets are scored and can be divided; however, do not crush or chew the whole or half tablet.")).toBe(
      "Metoprolol succinate extended-release tablets are scored and can be divided; however, do not crush or chew the whole or half tablet.",
    );
    expect(labelSentence("Table 2: Administration Instructions Formulation Route Instructions Do not split, chew, or crush PROTONIX Delayed-Release Tablets.")).toBe(
      "Do not split, chew, or crush PROTONIX Delayed-Release Tablets.",
    );
    expect(labelSentence("Swallow tablets whole.")).toBe("Swallow tablets whole.");
  });

  it("chips from the same source carry their section", () => {
    const m = review("metoprolol", JEJ);
    const labels = m.flags[0].citations.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

// One label for several products, like Protonix (tablets and granules for suspension).
describe("sugar alcohols on a label that covers several forms", () => {
  const PROTONIX = {
    dosage_form: "TABLET, DELAYED RELEASE; GRANULE, DELAYED RELEASE",
    description:
      "PROTONIX is supplied as a delayed-release tablet and as granules for delayed-release oral suspension. PROTONIX Delayed-Release Tablets contains the following inactive ingredients: calcium stearate, crospovidone, mannitol, povidone, and sodium carbonate. PROTONIX For Delayed-Release Oral Suspension contains the following inactive ingredients: crospovidone, microcrystalline cellulose, and talc.",
    spl_product_data_elements: "Protonix PANTOPRAZOLE SODIUM CALCIUM STEARATE CROSPOVIDONE MANNITOL Protonix PANTOPRAZOLE SODIUM CROSPOVIDONE TALC",
  };
  const reviewForm = (dosageForm: string, sections: Record<string, string>) =>
    reviewMed({ name: "Pantoprazole 40 mg", dosageForm, label: { found: true, sections }, scopeTags: scopeTagsFor(JEJ) });
  const sugar = (r: ReturnType<typeof reviewForm>) => r.flags.find((f) => f.kind === "sugar-alcohol");

  it("flags the tablet, quoting the sentence that ties mannitol to the tablets", () => {
    const f = sugar(reviewForm("TABLET, DELAYED RELEASE", PROTONIX))!;
    expect(f.citations[0].key).toBe("L:description");
    expect(f.citations[0].text).toMatch(/^PROTONIX Delayed-Release Tablets contains .*mannitol/);
    // A tablet cites the general rule, not the liquid-medicine chunk.
    expect(f.citations.map((c) => c.key)).not.toContain("G:sood-2013#liquid-excipients");
  });

  it("does not flag the granules, whose own ingredients have no sugar alcohol", () => {
    expect(sugar(reviewForm("GRANULE, DELAYED RELEASE", PROTONIX))).toBeUndefined();
  });

  it("ignores a flat ingredient list it can't tie to one product", () => {
    const { description: _d, ...flatOnly } = PROTONIX;
    expect(sugar(reviewForm("TABLET, DELAYED RELEASE", flatOnly))).toBeUndefined();
  });

  it("still reads a flat list when the label has one form", () => {
    const f = sugar(reviewForm("TABLET", { dosage_form: "TABLET", spl_product_data_elements: "ACME TABLET SORBITOL TALC" }))!;
    expect(f.citations[0].key).toBe("L:spl_product_data_elements");
  });
});
