/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const anonId = "answer-nudge-0001-aaaa";

async function setup() {
  const t = convexTest(schema, modules);
  retrierTest.register(t);
  await t.mutation(api.profiles.upsert, {
    anonId,
    role: "patient",
    language: "en",
    anatomy: { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "unknown" },
    anatomyConfirmed: false,
  });
  const [q] = await t.query(api.questions.listMine, { anonId });
  return { t, questionId: q._id };
}

describe("Did you get an answer?", () => {
  afterEach(() => vi.useRealTimers());

  it("appears three days after I asked this, not before, and goes away once answered", async () => {
    vi.useFakeTimers();
    const { t, questionId } = await setup();
    await t.mutation(api.questions.setAsked, { anonId, questionId, asked: true });
    vi.advanceTimersByTime(2 * 24 * 3600 * 1000);
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.questions.answerNudges, { anonId })).toHaveLength(0);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.questions.answerNudges, { anonId })).toHaveLength(1);

    await t.mutation(api.careTeam.logAnswer, {
      anonId,
      questionId,
      professionalType: "pharmacist",
      answerText: "Ask the surgeon's office for the operative report.",
      resultingChange: "pending",
    });
    expect(await t.query(api.questions.answerNudges, { anonId })).toHaveLength(0);
  });

  it("Not yet hides it and asks again after the same delay", async () => {
    vi.useFakeTimers();
    const { t, questionId } = await setup();
    await t.mutation(api.questions.setAsked, { anonId, questionId, asked: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(api.questions.snoozeAnswerNudge, { anonId, questionId });
    expect(await t.query(api.questions.answerNudges, { anonId })).toHaveLength(0);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.questions.answerNudges, { anonId })).toHaveLength(1);
  });
});
