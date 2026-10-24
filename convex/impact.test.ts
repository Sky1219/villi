/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";
import { tallyFunnel, tallyImpact } from "./lib/impact";
import { personFor, preparedBy } from "./lib/careFor";
import { OPEN_QUESTION_RE } from "./lib/answerSchema";

const modules = import.meta.glob("./**/*.ts");

const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const ANON = "test-device-0000000000000001";

describe("impact tally", () => {
  it("splits each metric by anatomy and by real vs demo", () => {
    const m = tallyImpact([
      { metric: "questionsAsked", anatomyKey: "end-jejunostomy", synthetic: false },
      { metric: "questionsAsked", anatomyKey: "end-jejunostomy", synthetic: true },
      { metric: "questionsAsked", anatomyKey: "ileostomy", synthetic: true },
      { metric: "formulationChanged", anatomyKey: "ileostomy", synthetic: false },
    ]);
    const asked = m.find((x) => x.key === "questionsAsked")!;
    expect([asked.real, asked.demo]).toEqual([1, 2]);
    expect(asked.byAnatomy.find((a) => a.anatomyKey === "end-jejunostomy")).toMatchObject({ real: 1, demo: 1 });
    expect(m.find((x) => x.key === "formulationChanged")).toMatchObject({ real: 1, demo: 0 });
  });
});

describe("ASK loop", () => {
  it("moves a question open -> asked -> back, and counts asked questions in the impact view", async () => {
    const t = convexTest(schema, modules);
    const questionId = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
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
      return await ctx.db.insert("questions", {
        profileId,
        text: "Is the extended-release tablet being absorbed?",
        context: {},
        resolved: false,
        status: "open",
        synthetic: false,
        createdAt: 0,
      });
    });

    await t.mutation(api.questions.setAsked, { anonId: ANON, questionId, asked: true });
    let sheet = await t.query(api.sheet.get, { anonId: ANON });
    expect(sheet.open[0].status).toBe("asked");
    expect(sheet.caresFor).toBe("parent");
    const impact = await t.query(api.impact.summary, { anonId: ANON });
    expect(impact.metrics.find((m) => m.key === "questionsAsked")).toMatchObject({ real: 1, demo: 0 });

    await t.mutation(api.questions.setAsked, { anonId: ANON, questionId, asked: false });
    sheet = await t.query(api.sheet.get, { anonId: ANON });
    expect(sheet.open[0].status).toBe("open");
  });

  it("refuses an open question as a new check", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.profiles.upsert, { anonId: ANON, role: "patient", language: "en", anatomy: JEJ });
    await expect(t.mutation(api.answers.start, { anonId: ANON, text: "What can I have that's sweet?" })).rejects.toThrow(
      /one named item/,
    );
  });
});

describe("caregiver wording", () => {
  it("names the patient by relationship, never by name", () => {
    expect(personFor("caregiver", "parent")).toBe("your parent");
    expect(personFor("patient", null)).toBe("you");
    expect(preparedBy("caregiver", "parent")).toBe("a family caregiver (their son or daughter)");
    expect(preparedBy("patient", null)).toBe("the patient");
  });

  it("treats questions as open questions but names as items", () => {
    expect(OPEN_QUESTION_RE.test("What can I have that's sweet?")).toBe(true);
    expect(OPEN_QUESTION_RE.test("Metoprolol succinate ER 50 mg")).toBe(false);
  });
});

describe("impact funnel", () => {
  it("counts each stage as a subset of the one before, by anatomy, with link answers split out", () => {
    const f = tallyFunnel(
      [{ anatomyKey: "end-jejunostomy" }, { anatomyKey: "end-jejunostomy" }, { anatomyKey: "end-jejunostomy" }, { anatomyKey: "ileostomy" }],
      [
        { anatomyKey: "end-jejunostomy", asked: true, answered: "team_link", changed: true, outcome: "helped" },
        { anatomyKey: "end-jejunostomy", asked: true, answered: "self", changed: false, outcome: null },
        { anatomyKey: "ileostomy", asked: false, answered: null, changed: false, outcome: null },
      ],
    );
    expect(f.map((s) => [s.key, s.total, s.pctOfPrevious])).toEqual([
      ["flagged", 4, null],
      ["saved", 3, 75],
      ["asked", 2, 67],
      ["answered", 2, 100],
      ["changed", 1, 50],
      ["outcome", 1, 100],
    ]);
    expect(f[3].split).toEqual({ self: 1, teamLink: 1 });
    expect(f[5].outcomes).toEqual({ helped: 1, neutral: 0, hurt: 0 });
    expect(f[0].byAnatomy.map((a) => [a.anatomyKey, a.n])).toEqual([["end-jejunostomy", 3], ["ileostomy", 1]]);
    expect(tallyFunnel([], [])[1].pctOfPrevious).toBeNull();
  });

  it("summary: the funnel and safety record count real writes only", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const mk = (anonId: string, synthetic: boolean) =>
        ctx.db.insert("profiles", { anonId, role: "caregiver", caresFor: "parent", anatomy: JEJ, anatomyKey: anatomyKeyOf(JEJ), language: "en", clinicianDemoVerified: false, synthetic, createdAt: 0 });
      const me = await mk(ANON, false);
      const demo = await mk("synthetic-demo-profile-000000001", true);
      const ans = (profileId: typeof me, status: "final" | "blocked" | "failed", state: string, edited = false, problem?: "confusing") =>
        ctx.db.insert("answers", {
          profileId,
          kind: "scan",
          input: { text: "x" },
          status,
          toolTrace: [],
          final: status === "final" ? { state } : undefined,
          reviewSummary: { approved: status === "final", edited, blockedReasons: [] },
          problemReport: problem,
          createdAt: 0,
        });
      const flagged = await ans(me, "final", "flagged", true, "confusing");
      await ans(me, "final", "nothing-found");
      await ans(me, "blocked", "");
      await ans(me, "failed", "");
      await ans(demo, "final", "flagged");
      const r = await ans(me, "final", "flagged");
      await ctx.db.insert("answer_reviews", { answerId: r, draft: {}, lint: ["removed claim: x", "removed swap: y"], registry: {}, attempts: 1, createdAt: 0 });
      const q = await ctx.db.insert("questions", { profileId: me, text: "q", context: { answerId: flagged }, resolved: true, status: "answered", afterChangeOutcome: "helped", synthetic: false, createdAt: 0 });
      await ctx.db.insert("care_team_answers", {
        profileId: me, anatomySnapshot: JEJ, anatomyKey: anatomyKeyOf(JEJ), questionId: q, questionText: "q", professionalType: "pharmacist",
        answerText: "a", resultingChange: "formulation_changed", source: "team_link", pooled: true, clinicianEndorsements: [], synthetic: false, createdAt: 0,
      });
      const log = (profileId: typeof me, pooled: boolean | null, note: string | undefined, synthetic = false) =>
        ctx.db.insert("log_entries", { profileId, anatomySnapshot: JEJ, anatomyKey: anatomyKeyOf(JEJ), itemText: "x", outcome: "hurt", note, pooled, synthetic, createdAt: 0 });
      await log(me, true, undefined);
      await log(me, false, "I fainted");
      await log(me, null, "very thirsty");
      await log(demo, true, undefined, true);
    });
    const d = await t.query(api.impact.summary, { anonId: ANON });
    expect(d.funnel.map((s) => s.total)).toEqual([2, 1, 1, 1, 1, 1]);
    expect(d.funnel[3].split).toEqual({ self: 0, teamLink: 1 });
    expect(d.safety.answers).toEqual({ approved: 2, edited: 1, blocked: 1, failed: 1 });
    expect(d.safety.codeChecks).toEqual({ answersTouched: 1, fixes: 2 });
    expect(d.safety.logs).toEqual({ shared: 1, private: 1, checking: 1, demoShared: 1 });
    expect(d.safety.warningCards).toEqual({ emergency: 1, dehydration: 1, softAfterWorseDrink: 0 });
    expect(d.safety.problemReports.confusing).toBe(1);
  });
});
