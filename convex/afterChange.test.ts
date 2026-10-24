/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const ANON = "overnight-afterchange-0000000001";

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  retrierTest.register(t);
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
      text: "Is the extended-release form being absorbed?",
      context: { itemName: "Metoprolol succinate ER 50 mg" },
      resolved: false,
      status: "asked",
      synthetic: false,
      createdAt: 0,
    });
  });
  return { t, questionId };
}

// Advance the clock and run only what is due, without firing later timers.
async function advanceDays(t: Awaited<ReturnType<typeof setup>>["t"], days: number) {
  await vi.advanceTimersByTimeAsync(days * 86_400_000);
  await t.finishInProgressScheduledFunctions();
}

describe("after a form change", () => {
  it("becomes due 14 days after the change, not before, and the outcome is a log linked to the question", async () => {
    const { t, questionId } = await setup();
    await t.mutation(api.careTeam.logAnswer, {
      anonId: ANON,
      questionId,
      professionalType: "pharmacist",
      answerText: "The cardiologist changed it to the immediate-release form.",
      resultingChange: "formulation_changed",
    });
    await t.mutation(api.questions.setNewForm, { anonId: ANON, questionId, name: "Metoprolol tartrate" });

    await advanceDays(t, 13);
    expect(await t.query(api.questions.followUpsDue, { anonId: ANON })).toEqual([]);
    await expect(t.mutation(api.questions.logAfterChange, { anonId: ANON, questionId, outcome: "helped" })).rejects.toThrow(/Nothing to follow up/);

    await advanceDays(t, 1.1);
    const due = await t.query(api.questions.followUpsDue, { anonId: ANON });
    expect(due).toEqual([{ _id: questionId, itemName: "Metoprolol succinate ER 50 mg", newFormName: "Metoprolol tartrate", synthetic: false }]);

    const logId = await t.mutation(api.questions.logAfterChange, { anonId: ANON, questionId, outcome: "hurt" });
    expect(await t.query(api.questions.followUpsDue, { anonId: ANON })).toEqual([]);
    const { q, log } = await t.run(async (ctx) => ({ q: await ctx.db.get("questions", questionId), log: await ctx.db.get("log_entries", logId) }));
    expect(q).toMatchObject({ afterChangeOutcome: "hurt", afterChangeLogId: logId });
    expect(log).toMatchObject({ outcome: "hurt", itemText: "Metoprolol tartrate", pooled: null, synthetic: false });
    const sheet = await t.query(api.sheet.get, { anonId: ANON });
    expect(sheet.answered[0]).toMatchObject({ afterChangeOutcome: "hurt", newFormName: "Metoprolol tartrate" });
  });

  it("other outcomes never start a follow-up, and a later update to 'form changed' does", async () => {
    const { t, questionId } = await setup();
    const id = await t.mutation(api.careTeam.logAnswer, {
      anonId: ANON,
      questionId,
      professionalType: "pharmacist",
      answerText: "We'll decide next visit.",
      resultingChange: "pending",
    });
    await advanceDays(t, 15);
    expect(await t.query(api.questions.followUpsDue, { anonId: ANON })).toEqual([]);
    await t.mutation(api.careTeam.setResultingChange, { anonId: ANON, id, resultingChange: "formulation_changed" });
    await advanceDays(t, 14.1);
    expect(await t.query(api.questions.followUpsDue, { anonId: ANON })).toHaveLength(1);
  });

  it("'Check the new form' links the check to its question", async () => {
    const { t, questionId } = await setup();
    const answerId = await t.mutation(api.answers.start, { anonId: ANON, text: "Metoprolol tartrate 25 mg", category: "pill", followsQuestionId: questionId });
    const a = await t.run(async (ctx) => ctx.db.get("answers", answerId));
    expect(a?.followsQuestionId).toBe(questionId);
  });
});
