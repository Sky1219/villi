/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };

describe("something's wrong with this answer", () => {
  it("records a fixed reason on the user's own final answers only, clears on a second tap, and is rate-limited", async () => {
    const t = convexTest(schema, modules);
    const me = "overnight-problem-me-000000000001";
    const other = "overnight-problem-other-0000000001";
    const ids = await t.run(async (ctx) => {
      const mk = (anonId: string) =>
        ctx.db.insert("profiles", { anonId, role: "patient", anatomy: JEJ, anatomyKey: anatomyKeyOf(JEJ), language: "en", clinicianDemoVerified: false, synthetic: false, createdAt: 0 });
      const mine = await mk(me);
      const theirs = await mk(other);
      const ans = (profileId: Id<"profiles">, status: "final" | "reviewing") =>
        ctx.db.insert("answers", { profileId, kind: "scan", input: { text: "x" }, status, toolTrace: [], final: {}, createdAt: 0 });
      const finals: Id<"answers">[] = [];
      for (let i = 0; i < 11; i++) finals.push(await ans(mine, "final"));
      return { finals, reviewing: await ans(mine, "reviewing"), theirs: await ans(theirs, "final") };
    });
    await t.mutation(api.answers.reportProblem, { anonId: me, answerId: ids.finals[0], kind: "unsupported_claim" });
    expect((await t.query(api.answers.get, { anonId: me, answerId: ids.finals[0] }))?.problemReport).toBe("unsupported_claim");
    await t.mutation(api.answers.reportProblem, { anonId: me, answerId: ids.finals[0], kind: null });
    expect((await t.query(api.answers.get, { anonId: me, answerId: ids.finals[0] }))?.problemReport).toBeNull();

    await expect(t.mutation(api.answers.reportProblem, { anonId: me, answerId: ids.theirs, kind: "other" })).rejects.toThrow(/not found/);
    await expect(t.mutation(api.answers.reportProblem, { anonId: me, answerId: ids.reviewing, kind: "other" })).rejects.toThrow(/not found/);

    for (let i = 0; i < 10; i++) await t.mutation(api.answers.reportProblem, { anonId: me, answerId: ids.finals[i], kind: "confusing" });
    await expect(t.mutation(api.answers.reportProblem, { anonId: me, answerId: ids.finals[10], kind: "confusing" })).rejects.toThrow(/a lot of reports/);
  });
});
