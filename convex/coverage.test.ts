import { describe, expect, it } from "vitest";
import { COVERAGE_NOTE, coverageNoteFor } from "./lib/coverage";
import type { Answer } from "./lib/answerSchema";

const base = { swapToAskAbout: null } as unknown as Answer;
const withSwap = (text: string) => ({ ...base, swapToAskAbout: { text, source: "guideline", citation: "[G:x]" } }) as Answer;

describe("coverage note", () => {
  it("is added under an extended-release to immediate-release or liquid swap", () => {
    expect(coverageNoteFor(withSwap("Ask whether an immediate-release version of the same medicine would work better."), ["dosage_form"])).toBe(COVERAGE_NOTE);
    expect(coverageNoteFor(withSwap("Ask whether a liquid form is available."), ["dosage_form"])).toBe(COVERAGE_NOTE);
  });

  it("is absent on a drink swap and on a swap that names neither form", () => {
    expect(coverageNoteFor(withSwap("Ask about an oral rehydration solution made for short bowel syndrome."), [])).toBeNull();
    expect(coverageNoteFor(withSwap("Ask about an oral rehydration solution instead."), ["dosage_form"])).toBeNull();
    expect(coverageNoteFor(withSwap("Ask the pharmacist to review this medicine."), ["dosage_form"])).toBeNull();
    expect(coverageNoteFor(base, ["dosage_form"])).toBeNull();
  });
});
