import { describe, expect, it, vi } from "vitest";
import { reviewDraft, type CitationRegistry } from "./lib/safety";
import type { Answer, ReviewerDecision } from "./lib/answerSchema";

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
});
