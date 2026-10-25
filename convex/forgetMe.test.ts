/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { applyPooledTransition } from "./community";

const modules = import.meta.glob("./**/*.ts");
const anonId = "forget-me-0001-aaaa-bbbb";
const ANATOMY = { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "<100cm" } as const;

describe("forget me", () => {
  it("deletes everything personal, keeps shared entries unlinked, and leaves counts unchanged", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.profiles.upsert, { anonId, role: "patient", language: "en", anatomy: ANATOMY });
    const { profileId, itemId } = await t.run(async (ctx) => {
      const p = (await ctx.db.query("profiles").withIndex("by_anonId", (q) => q.eq("anonId", anonId)).unique())!;
      const itemId = await ctx.db.insert("items", { canonicalName: "sports drink", category: "drink", aliases: [], attributes: {}, searchText: "sports drink", synthetic: false });
      const base = { profileId: p._id, anatomySnapshot: ANATOMY, anatomyKey: p.anatomyKey, itemId, synthetic: false, createdAt: Date.now() };
      const shared = await ctx.db.insert("log_entries", { ...base, outcome: "hurt", note: "dizzy after", pooled: true });
      await applyPooledTransition(ctx, { ...(await ctx.db.get("log_entries", shared))!, itemId }, 1);
      await ctx.db.insert("log_entries", { ...base, outcome: "helped", pooled: false });
      await ctx.db.insert("meds", { profileId: p._id, name: "Metoprolol succinate ER 50 mg", addedAt: Date.now() });
      await ctx.db.insert("device_link_attempts", { anonId, ok: false, at: Date.now() });
      return { profileId: p._id, itemId };
    });
    const countsBefore = await t.run((ctx) => ctx.db.query("aggregates").collect());

    let done = false;
    while (!done) done = (await t.mutation(api.profiles.deleteMine, { anonId })).done;

    await t.run(async (ctx) => {
      expect(await ctx.db.get("profiles", profileId)).toBeNull();
      for (const table of ["log_entries", "meds", "questions", "answers", "swaps", "care_team_answers", "device_link_attempts", "profiles"] as const) {
        const rows = await ctx.db.query(table).collect();
        const text = JSON.stringify(rows);
        expect(text).not.toContain(anonId);
        expect(text).not.toContain(profileId);
      }
      // The shared entry stays, under a stand-in nobody holds, with its note cleared.
      const logs = await ctx.db.query("log_entries").collect();
      expect(logs).toHaveLength(1);
      const standIn = (await ctx.db.get("profiles", logs[0].profileId))!;
      expect(standIn.forgotten).toBe(true);
      expect(logs[0].note).toBeUndefined();
      expect(logs[0].itemId).toBe(itemId);
    });
    expect(await t.run((ctx) => ctx.db.query("aggregates").collect())).toEqual(countsBefore);
    expect(await t.query(api.profiles.me, { anonId })).toBeNull();
  });
});
