import { describe, expect, it } from "vitest";
import { displayName } from "./displayName";

describe("displayName", () => {
  it("capitalizes the first letter and release abbreviations", () => {
    expect(displayName("metoprolol succinate er")).toBe("Metoprolol succinate ER");
    expect(displayName("venlafaxine er")).toBe("Venlafaxine ER");
    expect(displayName("oral rehydration solution")).toBe("Oral rehydration solution");
    expect(displayName("Metoprolol succinate ER 50 mg")).toBe("Metoprolol succinate ER 50 mg");
  });
  it("leaves words that only contain the letters alone", () => {
    expect(displayName("sugar-free candy")).toBe("Sugar-free candy");
    expect(displayName("water")).toBe("Water");
  });
});
