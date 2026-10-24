import { describe, expect, it } from "vitest";
import { checkSwap, type SwapItem } from "./lib/swapCheck";
import type { Anatomy } from "./lib/anatomy";
import { SEED_ITEMS, SEED_SWAPS, SYNTHETIC_GROUPS } from "./lib/seedData";

const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const COLON: Anatomy = { colonInContinuity: true, stomaType: "none", bowelLengthBand: "100-200cm" };

const cola: SwapItem = { canonicalName: "cola", category: "drink", attributes: { tonicity: "hypertonic", simpleSugar: true, caffeine: true } };
const water: SwapItem = { canonicalName: "water", category: "drink", attributes: { tonicity: "hypotonic" } };
const ors: SwapItem = { canonicalName: "oral rehydration solution", category: "drink", attributes: { tonicity: "ors" } };
const sports: SwapItem = { canonicalName: "sports drink", category: "drink", attributes: { tonicity: "hypertonic", simpleSugar: true } };

describe("swap guideline check", () => {
  it("rejects a soda swap, citing the hypertonic-drink guideline", () => {
    const r = checkSwap(water, cola, JEJ);
    expect(r.passed).toBe(false);
    expect(r.conflicts.map((c) => c.citation)).toContain("G:aga-sbs#fluids-hypertonic");
  });

  it("rejects a soda swap for someone with a colon too (hypertonic applies regardless of anatomy)", () => {
    expect(checkSwap(water, cola, COLON).passed).toBe(false);
  });

  it("passes the ORS swap with supporting citations", () => {
    const r = checkSwap(sports, ors, JEJ);
    expect(r.passed).toBe(true);
    expect(r.citations).toEqual(expect.arrayContaining(["G:aga-sbs#fluids-ors", "G:aga-sbs#fluids-hypertonic"]));
  });

  it("only applies the water rule to the anatomy it is scoped to", () => {
    expect(checkSwap(sports, water, JEJ).passed).toBe(false);
    expect(checkSwap(sports, water, COLON).passed).toBe(true);
  });

  it("every seeded swap passes the check for every anatomy its poster could have", () => {
    const item = new Map(SEED_ITEMS.map((i) => [i.canonicalName, i]));
    const failures = SEED_SWAPS.flatMap((s) =>
      SYNTHETIC_GROUPS.find((g) => g.key === s.anatomy)!.anatomies
        .filter((a) => !checkSwap(item.get(s.insteadOf)!, item.get(s.use)!, a).passed)
        .map((a) => `${s.insteadOf} -> ${s.use} (${JSON.stringify(a)})`),
    );
    expect(failures).toEqual([]);
  });
});
