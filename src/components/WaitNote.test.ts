import { describe, expect, it } from "vitest";
import { elapsedLabel, waitPhases } from "./WaitNote";

describe("WaitNote", () => {
  it("formats elapsed time as m:ss", () => {
    expect(elapsedLabel(0)).toBe("0:00");
    expect(elapsedLabel(9_400)).toBe("0:09");
    expect(elapsedLabel(65_000)).toBe("1:05");
    expect(elapsedLabel(-500)).toBe("0:00");
  });
  it("follows the answer status", () => {
    expect(waitPhases("queued")).toEqual(["now", "later", "later"]);
    expect(waitPhases("running")).toEqual(["now", "later", "later"]);
    expect(waitPhases("reviewing")).toEqual(["done", "done", "now"]);
  });
});
