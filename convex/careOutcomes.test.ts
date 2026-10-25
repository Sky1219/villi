/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";
import { tooFewToSay } from "./lib/careFor";
import { lintAnswer } from "./lib/safety";
import type { Answer } from "./lib/answerSchema";
import { seedCareOutcomes } from "./lib/seedData";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const ILEO: Anatomy = { colonInContinuity: false, stomaType: "ileostomy", bowelLengthBand: ">200cm" };
type Change = "formulation_changed" | "dose_monitored" | "no_change" | "pending";

async function setup() {
  const t = convexTest(schema, modules);
  retrierTest.register(t);
  const itemId = await t.run((ctx) =>
    ctx.db.insert("items", { canonicalName: "metoprolol succinate er", category: "pill", attributes: {}, aliases: [], searchText: "metoprolol succinate er", synthetic: true }),
  );
  // A moderated care-team answer from its own profile, pooled through careTeam.apply.
  const answer = async (a: Anatomy, change: Change, opts: { synthetic?: boolean; anonId?: string; pooled?: boolean } = {}) => {
    const id = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        anonId: opts.anonId ?? `overnight-care-${crypto.randomUUID()}`,
        role: "patient",
        anatomy: a,
        anatomyKey: anatomyKeyOf(a),
        language: "en",
        clinicianDemoVerified: false,
        synthetic: !!opts.synthetic,
        createdAt: 0,
      });
      return await ctx.db.insert("care_team_answers", {
        profileId,
        anatomySnapshot: a,
        anatomyKey: anatomyKeyOf(a),
        questionText: "Is the extended-release form absorbed?",
        itemId,
        professionalType: "pharmacist",
        answerText: "They reviewed it.",
        resultingChange: change,
        pooled: null,
        clinicianEndorsements: [],
        synthetic: !!opts.synthetic,
        createdAt: Date.now(),
      });
    });
    await t.mutation(internal.careTeam.apply, { id, pooled: opts.pooled ?? true, reason: null, nudge: null });
    return id;
  };
  const counts = () => t.query(internal.community.careOutcomesByItemId, { itemId, anatomyKey: "end-jejunostomy" });
  return { t, itemId, answer, counts };
}

describe("what care teams changed", () => {
  it("counts only pooled answers, stratified by anatomy, and flags synthetic rows", async () => {
    const { answer, counts } = await setup();
    for (const c of ["formulation_changed", "formulation_changed", "dose_monitored", "no_change"] as const) await answer(JEJ, c);
    await answer(JEJ, "formulation_changed", { pooled: false });
    await answer(ILEO, "no_change", { synthetic: true });
    const d = await counts();
    expect(d.byAnatomy[0]).toMatchObject({ anatomyKey: "end-jejunostomy", formulation_changed: 2, dose_monitored: 1, no_change: 1, pending: 0, total: 4 });
    expect(d.byAnatomy[1]).toMatchObject({ anatomyKey: "ileostomy", no_change: 1, total: 1 });
    expect(d.includesSynthetic).toBe(true);
  });

  it("says too few to say under 5", () => {
    expect([4, 5].map(tooFewToSay)).toEqual([true, false]);
  });

  it("moves the counters when an answer's outcome changes, and keeps them when its author forgets their data", async () => {
    const { t, answer, counts } = await setup();
    const anonId = "overnight-care-author-0000000001";
    const id = await answer(JEJ, "pending", { anonId });
    expect((await counts()).byAnatomy[0]).toMatchObject({ pending: 1, total: 1 });
    await t.mutation(api.careTeam.setResultingChange, { anonId, id: id as Id<"care_team_answers">, resultingChange: "formulation_changed" });
    expect((await counts()).byAnatomy[0]).toMatchObject({ pending: 0, formulation_changed: 1, total: 1 });
    // Forget me keeps a shared answer, unlinked, so the counts stay.
    for (let i = 0; i < 5; i++) if ((await t.mutation(api.profiles.deleteMine, { anonId })).done) break;
    expect((await counts()).byAnatomy[0]).toMatchObject({ formulation_changed: 1, total: 1 });
  });

  it("the agent's numbers are lint-checked against these counts", () => {
    const reg = {
      guidelineIds: ["aga-sbs#medications-release-forms"],
      labelSections: [],
      communityTotals: [7],
      careTeamIds: [],
      allowedStrengths: [],
      communityCells: [{ key: "end-jejunostomy", total: 7, counts: [4, 2, 1, 0] }],
    };
    const base: Answer = {
      state: "flagged",
      verdict: "This is an extended-release tablet.",
      why: [{ claim: "Sustained-release medicines should be avoided.", citation: "[G:aga-sbs#medications-release-forms]" }],
      swapToAskAbout: null,
      community: null,
      careTeamAnswers: [],
      personal: [],
      diagram: null,
      sourcesChecked: ["AGA 2022"],
      ask: "ASK: Is there another form of this medicine to discuss?",
      confidence: "medium",
      unidentified: false,
    };
    const ok = { claim: "4 of 7 people with an end-jejunostomy who asked reported that their team changed the form.", citation: "[C:4/7, end-jejunostomy]" };
    const bad = { claim: "5 of 7 people with an end-jejunostomy reported a form change.", citation: "[C:5/7, end-jejunostomy]" };
    expect(lintAnswer({ ...base, why: [...base.why, ok] }, reg).answer.why).toHaveLength(2);
    expect(lintAnswer({ ...base, why: [...base.why, bad] }, reg).answer.why).toHaveLength(1);
  });

  it("the seed gives the demo items plausible counts (5+ in the demo anatomy)", () => {
    const n = (item: string, anatomy: string) => seedCareOutcomes().filter((c) => c.item === item && c.anatomy === anatomy).length;
    expect(n("metoprolol succinate er", "end-jejunostomy")).toBeGreaterThanOrEqual(5);
    expect(n("pantoprazole dr", "end-jejunostomy")).toBeGreaterThanOrEqual(5);
    expect(n("sports drink", "end-jejunostomy")).toBeGreaterThanOrEqual(5);
    expect(n("loperamide", "end-jejunostomy")).toBeGreaterThanOrEqual(5);
  });
});
