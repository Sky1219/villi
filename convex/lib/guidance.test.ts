import { describe, expect, it } from "vitest";
import { AGAINST_GUIDANCE_NUDGE, isGoodOutcome, normalizeItem, sameItem } from "./guidance";

describe("against-guidance helpers", () => {
  it("matches a typed name to a flagged item, ignoring case, strength and punctuation", () => {
    expect(normalizeItem("Metoprolol succinate ER 50 mg")).toBe("metoprolol succinate er");
    expect(sameItem("metoprolol succinate er", "Metoprolol succinate ER 50 mg")).toBe(true);
    expect(sameItem("Metoprolol", "Metoprolol succinate ER 50 mg")).toBe(true);
    expect(sameItem("Gatorade", "gatorade")).toBe(true);
  });
  it("doesn't match a different item or a fragment of a word", () => {
    expect(sameItem("metformin", "Metoprolol succinate ER 50 mg")).toBe(false);
    expect(sameItem("meto", "Metoprolol succinate ER 50 mg")).toBe(false);
    expect(sameItem("er", "Metoprolol succinate ER")).toBe(false);
    expect(sameItem("water", "Gatorade")).toBe(false);
  });
  it("only asks about good or neutral outcomes", () => {
    expect(isGoodOutcome("helped")).toBe(true);
    expect(isGoodOutcome("neutral")).toBe(true);
    expect(isGoodOutcome("hurt")).toBe(false);
  });
  it("gives no advice in the note it shows", () => {
    expect(AGAINST_GUIDANCE_NUDGE).not.toMatch(/\b(stop|start|crush|split|switch|safe)\b/i);
  });
});
