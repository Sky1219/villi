import { describe, expect, it } from "vitest";
import { CARD_QUESTION, cardLine, cardMeds } from "./card";

describe("wallet card", () => {
  const er = { name: "Metoprolol succinate ER 50 mg", state: "flagged" as const, summary: "2 things to discuss.", requestFlags: [{ text: "Extended-release form (NDC listing: tablet, film coated, extended release)." }, { text: 'The label says: "Swallow whole"' }] };
  const lop = { name: "Loperamide 2 mg", state: "nothing-found" as const, summary: "Nothing found.", requestFlags: [] };
  const new1 = { name: "Ondansetron 4 mg", state: "cant-tell" as const, summary: "Label not checked yet.", requestFlags: [] };
  const missing = { name: "Zorblatrin", state: "cant-tell" as const, summary: "No FDA label found under this name. Check the spelling on the label, or run a full check.", requestFlags: [] };

  it("repeats the list review's own flag text, never a verdict of its own", () => {
    expect(cardLine(er)).toBe('Extended-release form (NDC listing: tablet, film coated, extended release). The label says: "Swallow whole"');
    expect(cardLine(lop)).toBe("Nothing found in the label sections checked.");
    expect(cardLine(new1)).toBe("Label not checked yet.");
    expect(cardLine(missing)).toMatch(/^No FDA label found/);
    for (const m of [er, lop, new1]) expect(cardLine(m).toLowerCase()).not.toMatch(/\bsafe\b/);
  });
  it("puts flagged medicines first", () => {
    expect(cardMeds([lop, new1, er]).map((m) => m.name)).toEqual([er.name, new1.name, lop.name]);
  });
  it("ends in exactly one question, with no dose and no directive", () => {
    expect(CARD_QUESTION.match(/\?/g)).toHaveLength(1);
    expect(CARD_QUESTION).not.toMatch(/\d/);
    expect(CARD_QUESTION).not.toMatch(/\b(stop|start|crush|split|switch)\b/i);
  });
});
