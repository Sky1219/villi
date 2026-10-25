import { describe, expect, it } from "vitest";
import { newsTarget, pilotTarget } from "./pilotTargets";

const funnel = [
  { key: "flagged", total: 10, outcomes: null },
  { key: "saved", total: 8, outcomes: null },
  { key: "asked", total: 4, outcomes: null },
  { key: "answered", total: 3, outcomes: null },
  { key: "changed", total: 1, outcomes: null },
  { key: "outcome", total: 1, outcomes: { helped: 1, neutral: 0, hurt: 0 } },
];

describe("pilot targets", () => {
  it("reads each threshold off the README's denominators", () => {
    expect(pilotTarget("asked", funnel)?.now).toBe("50% (4 of 8)"); // of saved
    expect(pilotTarget("changed", funnel)?.now).toBe("25% (1 of 4)"); // of asked, not of answered
    expect(pilotTarget("outcome", funnel)?.now).toBe("1 helped, 0 worse");
    expect(pilotTarget("flagged", funnel)).toBeNull();
    expect(newsTarget(3, 4).now).toBe("75% (3 of 4)");
  });
  it("says nothing yet rather than 0% when there is no denominator", () => {
    const empty = funnel.map((s) => ({ ...s, total: 0, outcomes: s.outcomes && { helped: 0, neutral: 0, hurt: 0 } }));
    expect(pilotTarget("asked", empty)?.now).toBeNull();
    expect(pilotTarget("changed", empty)?.now).toBeNull();
    expect(pilotTarget("outcome", empty)?.now).toBeNull();
    expect(newsTarget(0, 0).now).toBeNull();
  });
});
