import { describe, expect, it } from "vitest";
import { answerScript, forSpeech } from "./readAloud";

describe("forSpeech", () => {
  it("drops citation tokens and spells out release forms and units", () => {
    expect(forSpeech("Metoprolol succinate ER 50 mg is extended-release [L:dosage_form] [G:aga-sbs#drug-dosing].")).toBe(
      "Metoprolol succinate extended-release 50 milligrams is extended-release.",
    );
    expect(forSpeech("ORS has 75 mmol/L sodium [G:who-ors#composition]")).toBe(
      "oral rehydration solution has 75 millimoles per liter sodium",
    );
  });
  it("keeps the emergency room as the ER", () => {
    expect(forSpeech("If you feel faint, go to the ER.")).toBe("If you feel faint, go to the ER.");
    expect(forSpeech("ER at the start")).toBe("ER at the start");
    expect(forSpeech("The ER can help.")).toBe("The ER can help.");
  });
  it("leaves words that only contain the letters alone", () => {
    expect(forSpeech("Every answer ends here.")).toBe("Every answer ends here.");
  });
});

describe("answerScript", () => {
  const answer = {
    state: "flagged" as const,
    verdict: "This may not release fully in a short gut [G:aga-sbs#drug-dosing].",
    why: [{ claim: "The label lists it as extended-release [L:dosage_form]." }],
    swapToAskAbout: { text: "An immediate-release form [G:aga-sbs#drug-dosing]" },
    ask: "ASK: Is there a form of this medicine that suits my anatomy?",
  };

  it("reads the reviewed answer in order and ends on the one question", () => {
    const script = answerScript(answer, "metoprolol succinate ER");
    expect(script).toEqual([
      "metoprolol succinate extended-release.",
      "Flag to discuss.",
      "This may not release fully in a short gut.",
      "Why.",
      "The label lists it as extended-release.",
      "A swap to ask about. An immediate-release form",
      "Ask your pharmacist or doctor. Is there a form of this medicine that suits my anatomy?",
    ]);
    expect(script.join(" ")).not.toMatch(/\[(G|L|C|T):/);
  });

  it("skips empty sections and never speaks 'safe' for a no-concern answer", () => {
    const script = answerScript(
      { ...answer, state: "nothing-found", why: [], swapToAskAbout: null, verdict: "Nothing in the sources I checked." },
      null,
    );
    expect(script[0]).toBe("Nothing found in the sources I checked.");
    expect(script).not.toContain("Why.");
    expect(script.join(" ").toLowerCase()).not.toContain("safe");
  });
});
