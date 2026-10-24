/// <reference types="vite/client" />
// Planted-violation check for the illustrative CAT caption: a draft whose
// simulation caption carries numbers goes through the real review path
// (answers.saveDraft -> action retrier -> reviewer.run -> answers.finalize) and
// must come back blocked. The deterministic lint blocks it before any model call,
// so this needs no API key.
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import retrierTest from "@convex-dev/action-retrier/test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { Answer } from "../convex/lib/answerSchema";
import { COLON, type DiagramState } from "../convex/lib/anatomy";
import { emptyRegistry, type CitationRegistry } from "../convex/lib/safety";

const modules = import.meta.glob(["../convex/**/*.ts", "!../convex/**/*.test.ts"]);

const diagram: DiagramState = { removed: ["ileum", ...COLON], stomaAfter: "jejunum" };
const registry: CitationRegistry & { evidence: Record<string, string> } = {
  ...emptyRegistry(),
  guidelineIds: ["aga-sbs#medications-release-forms"],
  labelSections: ["dosage_form"],
  allowedStrengths: ["50 mg"],
  language: "en",
  simulation: { diagram, releaseForm: "extended-release", permeabilityClass: "unknown" },
  evidence: {
    "G:aga-sbs#medications-release-forms": "Extended-release and enteric-coated medications should be avoided after major bowel resection.",
    "L:dosage_form": "TABLET, FILM COATED, EXTENDED RELEASE",
  },
};

const draft = (caption: string | undefined): Answer => ({
  state: "flagged",
  verdict: "This is an extended-release tablet, which guidelines flag after major bowel resection.",
  why: [
    { claim: "The label lists it as an extended-release tablet.", citation: "[L:dosage_form]" },
    {
      claim: "Extended-release medicines are generally avoided after major bowel resection.",
      citation: "[G:aga-sbs#medications-release-forms]",
    },
  ],
  swapToAskAbout: null,
  community: null,
  careTeamAnswers: [],
  personal: [],
  diagram: null,
  simulation: {
    formulation: "extended-release",
    permeabilityClass: "unknown",
    citation: "[G:aga-sbs#medications-release-forms]",
    ...(caption === undefined ? {} : { caption }),
  },
  sourcesChecked: ["FDA label: dosage_form", "AGA clinical practice update"],
  ask: "ASK: Is there an immediate-release form of metoprolol succinate ER 50 mg that would work better for my anatomy?",
  confidence: "medium",
  unidentified: false,
});

async function review(caption: string) {
  const t = convexTest(schema, modules);
  retrierTest.register(t);
  const answerId: Id<"answers"> = await t.run(async (ctx) => {
    const profileId = await ctx.db.insert("profiles", {
      anonId: crypto.randomUUID(),
      role: "patient",
      anatomy: { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "<100cm" },
      anatomyKey: "end-jejunostomy",
      language: "en",
      clinicianDemoVerified: false,
      synthetic: true,
      diagram,
      createdAt: Date.now(),
    });
    return ctx.db.insert("answers", {
      profileId,
      kind: "scan",
      input: { text: "Metoprolol succinate ER 50 mg", category: "pill" },
      status: "running",
      toolTrace: [],
      createdAt: Date.now(),
    });
  });
  await t.mutation(internal.answers.saveDraft, { answerId, draft: draft(caption), registry });
  for (let i = 0; i < 100; i++) {
    const a = await t.run((ctx) => ctx.db.get("answers", answerId));
    if (a && a.status !== "reviewing") return a;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("review did not finish");
}

it("blocks a planted numeric illustration caption", async () => {
  for (const caption of [
    "Illustration: about 70% of this tablet leaves through your stoma unreleased.",
    "Illustration: only one third of the dose is absorbed; fraction absorbed 0.3.",
    "Illustration: an extended-release tablet keeps releasing for 12 hours after it has passed the parts of the intestine that are left.",
  ]) {
    const a = await review(caption);
    console.log(`[planted] ${a.status}: ${a.reviewSummary?.blockedReasons.join("; ")}`);
    expect(a.status).toBe("blocked");
    expect(a.final).toBeUndefined();
    expect(a.reviewSummary?.blockedReasons.join(" ")).toMatch(/numeric language/);
  }
});
