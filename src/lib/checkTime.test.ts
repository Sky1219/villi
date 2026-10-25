import { describe, expect, it } from "vitest";
import { checkSeconds } from "./checkTime";

describe("checkSeconds", () => {
  it("measures from asking to the last trace step", () => {
    expect(checkSeconds(1_000, [{ at: 5_000 }, { at: 35_400 }])).toBe(34);
  });
  it("says nothing when the times don't make sense", () => {
    expect(checkSeconds(1_000, [])).toBeNull();
    expect(checkSeconds(50_000, [{ at: 10_000 }])).toBeNull();
    expect(checkSeconds(0, [{ at: 20 * 60_000 }])).toBeNull();
  });
});
