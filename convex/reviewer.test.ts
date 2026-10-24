import { describe, expect, it, vi } from "vitest";
import { reviewDraft, type CitationRegistry } from "./lib/safety";
import type { Answer, ReviewerDecision } from "./lib/answerSchema";
import { COLON, type DiagramState } from "./lib/anatomy";

const registry: CitationRegistry = {
  guidelineIds: ["aga-sbs#medications-release-forms", "pg139#time-release"],
  labelSections: ["dosage_form", "dosage_and_administration"],
  communityTotals: [19],
  careTeamIds: [],
  allowedStrengths: ["50 mg"],
};

const good: Answer = {
  state: "flagged",
  verdict: "This is an extended-release tablet, which guidelines flag after major bowel resection.",
  why: [
    { claim: "The label lists it as an extended-release tablet.", citation: "[L:dosage_form]" },
    { claim: "Sustained-release forms are generally avoided after extensive resection.", citation: "[G:aga-sbs#medications-release-forms]" },
    { claim: "14 of 19 people with an end-jejunostomy logged it as not seeming to work.", citation: "[C:14/19, end-jejunostomy]" },
  ],
  swapToAskAbout: { text: "Ask whether an immediate-release version exists.", source: "guideline", citation: "[G:pg139#time-release]" },
  community: { matchingAnatomy: { helped: 3, neutral: 2, hurt: 14 }, other: { helped: 20, neutral: 10, hurt: 8 }, includesSynthetic: true },
  careTeamAnswers: [],
  personal: [],
  diagram: null,
  sourcesChecked: ["FDA label: dosage_form", "AGA 2022"],
  ask: "ASK: Is there an immediate-release form of metoprolol succinate ER 50 mg that would absorb better for me?",
  confidence: "medium",
  unidentified: false,
};

const approve = vi.fn(async (): Promise<ReviewerDecision> => ({ approved: true, edits: null, blockedReasons: [] }));

describe("reviewer", () => {
  it("passes a cited, question-ending answer", async () => {
    const out = await reviewDraft(good, registry, approve);
    expect(out.status).toBe("final");
  });

  it("blocks a dose change even when the LLM reviewer would approve", async () => {
    const draft: Answer = {
      ...good,
      verdict: "You should stop taking it and switch to the tablet form.",
      why: [...good.why, { claim: "Take half a tablet twice a day instead.", citation: "[L:dosage_and_administration]" }],
    };
    const out = await reviewDraft(draft, registry, approve);
    expect(out.status).toBe("blocked");
    if (out.status === "blocked") {
      expect(out.blockedReasons.some((r) => r.includes("medication directive"))).toBe(true);
    }
  });

  it("blocks dosing quantities", async () => {
    const draft: Answer = { ...good, swapToAskAbout: { ...good.swapToAskAbout!, text: "Drink 500 ml of ORS instead." } };
    const out = await reviewDraft(draft, registry, approve);
    expect(out.status).toBe("blocked");
  });

  it("removes uncited and fabricated citations, and blocks when nothing cited remains", async () => {
    const partly: Answer = {
      ...good,
      why: [
        ...good.why,
        { claim: "It is absorbed in the colon.", citation: "" },
        { claim: "A made-up guideline says so.", citation: "[G:aga-sbs#does-not-exist]" },
        { claim: "Wrong community fraction.", citation: "[C:9/12, end-jejunostomy]" },
      ],
    };
    const kept = await reviewDraft(partly, registry, approve);
    expect(kept.status === "blocked" ? kept.blockedReasons : "final").toBe("final");
    if (kept.status === "final") expect(kept.final.why).toHaveLength(3);

    const uncited: Answer = { ...good, why: [{ claim: "Extended-release tablets do not work for you.", citation: "my experience" }] };
    const out = await reviewDraft(uncited, registry, approve);
    expect(out.status).toBe("blocked");
  });

  it("blocks when the ASK line is missing", async () => {
    const out = await reviewDraft({ ...good, ask: "Talk to your doctor." }, registry, approve);
    expect(out.status).toBe("blocked");
  });

  it("honors the LLM reviewer blocking a paraphrased instruction", async () => {
    const paraphrase: Answer = { ...good, verdict: "Breaking it up first is probably your best bet." };
    const block = async (): Promise<ReviewerDecision> => ({ approved: false, edits: null, blockedReasons: ["suggests splitting"] });
    const out = await reviewDraft(paraphrase, registry, block);
    expect(out.status).toBe("blocked");
  });

  it("rejects reviewer edits that add citations not in the draft", async () => {
    const edit = async (): Promise<ReviewerDecision> => ({
      approved: true,
      edits: JSON.stringify({ ...good, why: [...good.why, { claim: "Extra.", citation: "[G:pg139#time-release]" }], swapToAskAbout: null, diagram: null }),
      blockedReasons: [],
    });
    const added = { ...good, swapToAskAbout: null };
    const out = await reviewDraft(added, registry, edit);
    expect(out.status).toBe("blocked");
  });

  it("removes a claim about another medicine on file even when it cites a retrieved label section", async () => {
    const reg = { ...registry, otherMedWords: ["ondansetron"] };
    const draft: Answer = {
      ...good,
      why: [...good.why, { claim: "Ondansetron's label warns it can prolong the QT interval.", citation: "[L:dosage_and_administration]" }],
    };
    const out = await reviewDraft(draft, reg, approve);
    expect(out.status).toBe("final");
    if (out.status === "final") expect(out.final.why.some((w) => /ondansetron/i.test(w.claim))).toBe(false);
  });

  it("blocks a verdict that brings in another medicine on file", async () => {
    const reg = { ...registry, otherMedWords: ["ondansetron"] };
    const out = await reviewDraft({ ...good, verdict: "Worth checking because ondansetron is also on the list." }, reg, approve);
    expect(out.status).toBe("blocked");
  });

  it("blocks spelled-out doses and frequencies", async () => {
    for (const text of ["Ask about taking half a tablet.", "Some people take it twice a day.", "Spacing it every 6 hours helps.", "Two capsules may be needed."]) {
      const out = await reviewDraft({ ...good, swapToAskAbout: { ...good.swapToAskAbout!, text } }, registry, approve);
      expect({ text, status: out.status }).toEqual({ text, status: "blocked" });
    }
  });

  it("never applies an edit the reviewer did not approve", async () => {
    const edit = vi.fn(async (): Promise<ReviewerDecision> => ({ approved: false, edits: JSON.stringify(good), blockedReasons: ["unsupported claim"] }));
    const out = await reviewDraft(good, registry, edit);
    expect(out.status).toBe("blocked");
  });
});

describe("release illustration (cut)", () => {
  const endJejunostomy: DiagramState = { removed: ["ileum", ...COLON], stomaAfter: "jejunum" };
  const simReg: CitationRegistry = {
    ...registry,
    simulation: { diagram: endJejunostomy, releaseForm: "extended-release", permeabilityClass: "unknown" },
  };
  const withSim = (sim: Partial<NonNullable<Answer["simulation"]>> = {}): Answer => ({
    ...good,
    simulation: {
      formulation: "extended-release",
      permeabilityClass: "high",
      citation: "[G:aga-sbs#medications-release-forms]",
      ...sim,
    },
  });

  // The release illustration is cut from this build: the lint drops it from every draft.
  it("drops any illustration, including a planted numeric caption, and the answer still goes out", async () => {
    for (const draft of [
      withSim(),
      withSim({ caption: "Illustration: about 70% of this tablet leaves through your stoma unreleased." }),
      withSim({ caption: "Illustration: this tablet will not work for you." }),
    ]) {
      const out = await reviewDraft(draft, simReg, approve);
      expect(out.status).toBe("final");
      if (out.status === "final") expect(out.final.simulation).toBeNull();
    }
  });

  it("drops the illustration without a guideline or label citation, or when the label's release form differs", async () => {
    for (const [draft, reg] of [
      [withSim({ citation: "[C:14/19, end-jejunostomy]" }), simReg],
      [withSim(), { ...simReg, simulation: { ...simReg.simulation!, releaseForm: "immediate-release" } }],
      [withSim(), { ...simReg, language: "es" }],
    ] as const) {
      const out = await reviewDraft(draft, reg, approve);
      expect(out.status).toBe("final");
      if (out.status === "final") expect(out.final.simulation).toBeNull();
    }
  });
});
