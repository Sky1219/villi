/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const A = "overnight-teamlink-profile-a-0001";
const B = "overnight-teamlink-profile-b-0001";

afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  retrierTest.register(t);
  const q = await t.run(async (ctx) => {
    const out: Record<string, Id<"questions">[]> = {};
    for (const anonId of [A, B]) {
      const profileId = await ctx.db.insert("profiles", {
        anonId,
        role: "caregiver",
        caresFor: "parent",
        anatomy: JEJ,
        anatomyKey: anatomyKeyOf(JEJ),
        language: "en",
        clinicianDemoVerified: false,
        synthetic: false,
        createdAt: 0,
      });
      out[anonId] = [];
      for (let i = 0; i < 7; i++) {
        out[anonId].push(
          await ctx.db.insert("questions", {
            profileId,
            text: `${anonId === A ? "A" : "B"} question ${i}: is the extended-release form being absorbed?`,
            context: { itemName: "Metoprolol succinate ER 50 mg" },
            resolved: false,
            status: "open",
            synthetic: false,
            createdAt: i,
          }),
        );
      }
    }
    return out;
  });
  return { t, q };
}

const respond = (questionId: Id<"questions">, token: string) => ({
  token,
  questionId,
  professionalType: "pharmacist" as const,
  resultingChange: "formulation_changed" as const,
});

describe("care-team link", () => {
  it("shows the sheet without the anonId, and a response marks the question answered with source team_link", async () => {
    const { t, q } = await setup();
    const { token } = await t.mutation(api.careTeam.createLink, { anonId: A });
    expect(token.length).toBeGreaterThanOrEqual(32);
    const view = await t.query(api.careTeam.linkView, { token });
    expect(view.expired).toBe(false);
    expect(JSON.stringify(view)).not.toContain(A);
    if (!view.expired) expect(view.open).toHaveLength(7);

    await t.mutation(api.careTeam.linkRespond, { ...respond(q[A][0], token), note: "Asked the cardiologist to review the form." });
    const sheet = await t.query(api.sheet.get, { anonId: A });
    const answered = sheet.answered.find((x) => x._id === q[A][0])!;
    expect(answered.answer).toMatchObject({ source: "team_link", resultingChange: "formulation_changed", status: "checking" });
    expect(answered.answer?.text).toBe("Asked the cardiologist to review the form.");
    // A second answer to the same question is refused.
    await expect(t.mutation(api.careTeam.linkRespond, respond(q[A][0], token))).rejects.toThrow(/already has an answer/);
  });

  it("a token for profile A can't read or write profile B", async () => {
    const { t, q } = await setup();
    const { token } = await t.mutation(api.careTeam.createLink, { anonId: A });
    await expect(t.mutation(api.careTeam.linkRespond, respond(q[B][0], token))).rejects.toThrow(/Question not found/);
    const view = await t.query(api.careTeam.linkView, { token });
    expect(JSON.stringify(view)).not.toContain("B question");
  });

  it("revoked and expired tokens show 'expired' and refuse writes", async () => {
    vi.useFakeTimers();
    const { t, q } = await setup();
    const revoked = await t.mutation(api.careTeam.createLink, { anonId: A });
    await t.mutation(api.careTeam.revokeLink, { anonId: A, token: revoked.token });
    expect((await t.query(api.careTeam.linkView, { token: revoked.token })).expired).toBe(true);
    await expect(t.mutation(api.careTeam.linkRespond, respond(q[A][1], revoked.token))).rejects.toThrow(/expired/);

    const old = await t.mutation(api.careTeam.createLink, { anonId: A });
    vi.advanceTimersByTime(15 * 86_400_000);
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.query(api.careTeam.linkView, { token: old.token })).expired).toBe(true);
    await expect(t.mutation(api.careTeam.linkRespond, respond(q[A][1], old.token))).rejects.toThrow(/expired/);
    expect((await t.query(api.careTeam.linkView, { token: "not-a-real-token-but-long-enough-000" })).expired).toBe(true);
  });

  it("caps active links at 3 and throttles responses", async () => {
    const { t, q } = await setup();
    for (let i = 0; i < 3; i++) await t.mutation(api.careTeam.createLink, { anonId: A });
    await expect(t.mutation(api.careTeam.createLink, { anonId: A })).rejects.toThrow(/3 active links/);
    const [{ token }] = await t.query(api.careTeam.myLinks, { anonId: A });
    for (let i = 0; i < 5; i++) await t.mutation(api.careTeam.linkRespond, respond(q[A][i], token));
    await expect(t.mutation(api.careTeam.linkRespond, respond(q[A][5], token))).rejects.toThrow(/a lot of answers/);
  });
});
