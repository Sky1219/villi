import { describe, expect, it } from "vitest";
import { AMOUNT_RE, fridgeSheet } from "./lib/fridge";
import type { Anatomy } from "./lib/anatomy";

const JEJ: Anatomy = { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "<100cm" };
const COLON: Anatomy = { stomaType: "none", colonInContinuity: true, bowelLengthBand: "100-200cm" };
const drink = (name: string, attributes: Record<string, string | boolean>, tolerated: number, total: number, synthetic = true) => ({
  name,
  tolerated,
  total,
  synthetic,
  item: { canonicalName: name, category: "drink" as const, attributes },
});

describe("fridge sheet", () => {
  const drinks = [
    drink("oral rehydration solution", { tonicity: "ors" }, 11, 12),
    drink("regular soda", { tonicity: "hypertonic", simpleSugar: true }, 9, 10),
    drink("water", { tonicity: "hypotonic" }, 8, 10),
    drink("broth", { salty: true }, 2, 3),
  ];

  it("prints no amounts anywhere, and badges demo data", () => {
    const s = fridgeSheet(JEJ, drinks);
    const text = JSON.stringify([s.sections.map((x) => x.lines.map((l) => l.text)), s.ask]);
    expect(text).not.toMatch(AMOUNT_RE);
    expect(s.sections.flatMap((x) => x.lines).every((l) => !/\d/.test(l.text))).toBe(true);
    expect(s.synthetic).toBe(true);
  });

  it("never lists a drink the guidelines say to limit for this anatomy, however many logged it as fine", () => {
    const jej = fridgeSheet(JEJ, drinks).community.map((d) => d.name);
    expect(jej).toEqual(["oral rehydration solution"]); // soda (sugary) and water (hypotonic, end-jejunostomy) are out; broth has too few reports
    const colon = fridgeSheet(COLON, drinks).community.map((d) => d.name);
    expect(colon).toContain("water");
    expect(colon).not.toContain("regular soda");
  });

  it("shows only the guideline lines in scope for the anatomy", () => {
    const keys = (a: Anatomy) => fridgeSheet(a, []).sections.flatMap((s) => s.lines.map((l) => l.chunkId));
    expect(keys(JEJ)).toContain("pd-2017#hypotonic-jejunostomy");
    expect(keys(JEJ)).not.toContain("pd-2017#hypotonic-colon");
    expect(keys(COLON)).toContain("pd-2017#hypotonic-colon");
  });
});
