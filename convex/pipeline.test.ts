/// <reference types="vite/client" />
// End to end: answers.start -> agent.run -> saveDraft -> reviewer.run -> finalize,
// with Anthropic and openFDA replaced by a scripted fetch.
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";
import { SEED_ITEMS } from "./lib/seedData";
import { extractCitations, type CitationRegistry } from "./lib/safety";
import type { Answer } from "./lib/answerSchema";
import { installFetch, text, toolUse, type ClaudeReply } from "../testing/fetchMock";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const ANON = "overnight-pipeline-0000000000001";

const LABEL = {
  results: [
    {
      id: "spl-metoprolol",
      effective_time: "20250101",
      openfda: { brand_name: ["Metoprolol Succinate"], generic_name: ["METOPROLOL SUCCINATE"], route: ["ORAL"], manufacturer_name: ["Test Pharma"] },
      dosage_and_administration: ["Swallow tablets whole. Do not crush or chew."],
      description: ["Metoprolol succinate extended-release tablets."],
    },
  ],
};
const NDC = { results: [{ spl_id: "spl-metoprolol", dosage_form: "TABLET, FILM COATED, EXTENDED RELEASE" }] };

const draft: Answer = {
  state: "flagged",
  verdict: "This is an extended-release tablet, a form guidance says to avoid after major resection.",
  why: [
    { claim: "The NDC listing says it is a film-coated extended-release tablet.", citation: "[L:dosage_form]" },
    { claim: "Sustained- and delayed-release medicines should be avoided in short bowel syndrome.", citation: "[G:aga-sbs#medications-release-forms]" },
  ],
  swapToAskAbout: null,
  community: null,
  careTeamAnswers: [],
  personal: [],
  diagram: null,
  sourcesChecked: ["FDA label: dosage_form", "AGA 2022"],
  ask: "ASK: Is there a form of metoprolol succinate ER 50 mg that would absorb better for my parent?",
  confidence: "medium",
  unidentified: false,
};

const canonReply = text({
  matchCanonicalName: "metoprolol succinate er",
  canonicalName: "metoprolol succinate er",
  category: "pill",
  tonicity: "none",
  simpleSugar: false,
  sugarAlcohol: null,
  caffeine: false,
  releaseForm: "extended-release",
  thickening: false,
  lactose: false,
});
const agentTurns: ClaudeReply[] = [
  [toolUse("search_guidelines", { query: "extended-release tablet absorption" })],
  [toolUse("submit_answer", draft)],
];

async function setup(reviewer: ClaudeReply[]) {
  vi.useFakeTimers();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  const net = installFetch({
    claude: [canonReply, ...agentTurns, ...reviewer],
    fda: [
      { match: "ndc.json", body: NDC },
      { match: "label.json", body: LABEL },
    ],
  });
  const t = convexTest(schema, modules);
  retrierTest.register(t);
  await t.mutation(internal.guidelines.syncCorpus, {});
  await t.run(async (ctx) => {
    const seed = SEED_ITEMS.find((i) => i.canonicalName === "metoprolol succinate er")!;
    await ctx.db.insert("items", { ...seed, searchText: [seed.canonicalName, ...seed.aliases].join(" "), synthetic: true });
    await ctx.db.insert("profiles", {
      anonId: ANON,
      role: "caregiver",
      caresFor: "parent",
      anatomy: JEJ,
      anatomyKey: anatomyKeyOf(JEJ),
      language: "en",
      clinicianDemoVerified: false,
      synthetic: false,
      createdAt: 0,
    });
  });
  const answerId = await t.mutation(api.answers.start, { anonId: ANON, text: "Metoprolol succinate ER 50 mg" });
  return { t, net, answerId };
}

// Step the clock in small increments so the reviewer and its retries run
// before the five-minute watchdog would.
async function runFor(t: Awaited<ReturnType<typeof setup>>["t"], seconds: number) {
  for (let i = 0; i < seconds * 2; i++) {
    await vi.advanceTimersByTimeAsync(500);
    await t.finishInProgressScheduledFunctions();
  }
}

async function reviewRow(t: Awaited<ReturnType<typeof setup>>["t"], answerId: Id<"answers">) {
  return t.run(async (ctx) => ctx.db.query("answer_reviews").withIndex("by_answerId", (q) => q.eq("answerId", answerId)).first());
}

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("answer pipeline", () => {
  it("never exposes the draft, and the final cites only what was retrieved, with one ASK", async () => {
    const { t, answerId } = await setup([text({ approved: true, edits: null, blockedReasons: [] })]);

    // Run the agent alone: the draft exists, but the client sees nothing of it.
    await t.action(internal.agent.run, { answerId });
    const pending = await t.query(api.answers.get, { anonId: ANON, answerId });
    expect(pending?.status).toBe("reviewing");
    expect(pending?.final).toBeNull();
    expect(JSON.stringify(pending)).not.toContain("film-coated extended-release tablet");
    const review = await reviewRow(t, answerId);
    expect((review?.draft as Answer).why).toHaveLength(2);

    // The scheduled reviewer (through the retrier) finalizes it.
    await runFor(t, 60);
    const done = await t.query(api.answers.get, { anonId: ANON, answerId });
    expect(done?.status).toBe("final");
    const final = done!.final as Answer & { evidence: Record<string, unknown> };
    const reg = (await reviewRow(t, answerId))!.registry as CitationRegistry;
    for (const c of [...final.why.map((w) => w.citation), final.diagram?.citation ?? "", final.swapToAskAbout?.citation ?? ""].flatMap(extractCitations)) {
      if (c.kind === "G") expect(reg.guidelineIds).toContain(c.ref);
      if (c.kind === "L") expect(reg.labelSections).toContain(c.ref);
    }
    const allText = JSON.stringify(final);
    expect(allText.match(/ASK:/g)).toHaveLength(1);
    expect(final.evidence["G:aga-sbs#medications-release-forms"]).toBeTruthy();
    expect(done!.toolTrace.map((s) => s.tool)).toEqual(
      expect.arrayContaining(["get_profile", "canonicalize_item", "fetch_label", "search_guidelines", "submit_answer", "reviewer"]),
    );
  });

  it("fails closed when the reviewer always throws: blocked, 'reviewer unavailable'", async () => {
    const broken = Array.from({ length: 6 }, (): ClaudeReply => () => new Error("reviewer exploded"));
    const { t, answerId } = await setup(broken);
    await runFor(t, 60);
    const a = await t.query(api.answers.get, { anonId: ANON, answerId });
    expect(a?.status).toBe("blocked");
    expect(a?.final).toBeNull();
    expect(a?.reviewSummary?.blockedReasons).toEqual(["reviewer unavailable"]);
  });

  it("blocks when the reviewer does not approve", async () => {
    const { t, answerId } = await setup([text({ approved: false, edits: null, blockedReasons: ["claim not supported by its source"] })]);
    await runFor(t, 60);
    const a = await t.query(api.answers.get, { anonId: ANON, answerId });
    expect(a?.status).toBe("blocked");
    expect(a?.final).toBeNull();
    expect(a?.reviewSummary?.blockedReasons).toEqual(["claim not supported by its source"]);
  });
});
