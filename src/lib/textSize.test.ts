import { describe, expect, it } from "vitest";
import { TEXT_SIZE_BOOT, parseTextSize } from "./textSize";

describe("parseTextSize", () => {
  it("accepts the three sizes and falls back to standard", () => {
    expect(parseTextSize("large")).toBe("large");
    expect(parseTextSize("largest")).toBe("largest");
    expect(parseTextSize("huge")).toBe("standard");
    expect(parseTextSize(null)).toBe("standard");
  });
});

describe("TEXT_SIZE_BOOT", () => {
  it("is valid JavaScript that never throws, even without storage", () => {
    expect(() => new Function(TEXT_SIZE_BOOT)).not.toThrow();
    const doc = { documentElement: { dataset: {} as Record<string, string> } };
    new Function("localStorage", "document", TEXT_SIZE_BOOT)(
      { getItem: () => { throw new Error("blocked"); } },
      doc,
    );
    expect(doc.documentElement.dataset.text).toBeUndefined();
    new Function("localStorage", "document", TEXT_SIZE_BOOT)({ getItem: () => "largest" }, doc);
    expect(doc.documentElement.dataset.text).toBe("largest");
  });
});
