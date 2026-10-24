import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import { FACT_FIELDS, lookupDrug, recordReleaseForm, type DrugTable } from "./lib/drugTable";
import drugsJson from "../data/drugs.json";

const modules = import.meta.glob("./**/*.ts");
const table = drugsJson as unknown as DrugTable;

// The pill checks run on stage: the demo profile's ER, DR and sorbitol-liquid meds.
const DEMO_ITEMS = [
  { name: "Metoprolol succinate ER 50 mg", releaseForm: "extended-release" },
  { name: "Pantoprazole sodium DR 40 mg", releaseForm: "delayed-release" },
  { name: "Tylenol Extra Strength liquid", releaseForm: "liquid" },
] as const;

afterEach(() => vi.unstubAllGlobals());

describe("drug table", () => {
  it("has evidence for every non-null fact", () => {
    expect(table.recordCount).toBe(table.records.length);
    for (const r of table.records) {
      for (const f of ["genericName", "dosageForm", ...FACT_FIELDS] as const) {
        if (r[f] === null) continue;
        expect(r.evidence[f]?.quote, `${r.id}.${f}`).toBeTruthy();
        expect(r.evidence[f]?.section, `${r.id}.${f}`).toBeTruthy();
        expect(r.evidence[f].quote.trim().split(/\s+/).length, `${r.id}.${f}`).toBeLessThan(15);
      }
    }
  });

  it("never answers across release forms", () => {
    const er = lookupDrug(table.records, "metoprolol succinate ER");
    expect(er && recordReleaseForm(er.record)).toBe("extended-release");
    // No immediate-release metoprolol succinate exists, so "IR" wording must not borrow the ER record.
    expect(lookupDrug(table.records, "metoprolol succinate", "immediate-release")).toBeNull();
    expect(lookupDrug(table.records, "Toprol XL")?.match).toBe("alias");
  });

  for (const item of DEMO_ITEMS) {
    it(`fetch_label resolves "${item.name}" from the table in under 300 ms, without the network`, async () => {
      const fetchSpy = vi.fn(() => Promise.reject(new Error("network must not be used")));
      vi.stubGlobal("fetch", fetchSpy);
      const t = convexTest(schema, modules);
      const started = performance.now();
      const label = await t.action(internal.fda.fetchLabel, { name: item.name });
      const ms = performance.now() - started;
      expect(label.source).toBe("table");
      expect(label.found).toBe(true);
      expect(label.releaseForm).toBe(item.releaseForm);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(ms).toBeLessThan(300);
    });
  }

  it("the Tylenol liquid record flags sorbitol from its own label quote", () => {
    const hit = lookupDrug(table.records, "Tylenol Extra Strength liquid");
    expect(hit?.record.containsSorbitol).toBe(true);
    expect(hit?.record.evidence.containsSorbitol.quote.toLowerCase()).toContain("sorbitol");
  });
});
