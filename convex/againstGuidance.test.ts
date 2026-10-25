/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { AGAINST_GUIDANCE_NUDGE } from "./lib/guidance";

const modules = import.meta.glob("./**/*.ts");
const anonId = "against-guidance-0001-aaaa";
const ANATOMY = { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "<100cm" } as const;

async function setup() {
  const t = convexTest(schema, modules);
  retrierTest.register(t);
  await t.mutation(api.profiles.upsert, { anonId, role: "caregiver", language: "en", anatomy: ANATOMY });
  const ids = await t.run(async (ctx) => {
    const p = (await ctx.db.query("profiles").withIndex("by_anonId", (q) => q.eq("anonId", anonId)).unique())!;
    const item = (name: string) =>
      ctx.db.insert("items", { canonicalName: name, category: "drink", aliases: [], attributes: {}, searchText: name, synthetic: false });
    const gatorade = await item("gatorade");
    const ors = await item("oral rehydration solution");
    const answer = (itemId: Id<"items">, identified: string, state: string, createdAt: number) =>
      ctx.db.insert("answers", {
        profileId: p._id,
        kind: "scan",
        input: { text: identified },
        status: "final",
        identified,
        itemId,
        toolTrace: [],
        final: { state, verdict: `${identified} verdict [G:aga-sbs#fluids-sports-drinks]` },
        createdAt,
      });
    const flagged = await answer(gatorade, "gatorade", "flagged", 1);
    const clear = await answer(ors, "oral rehydration solution", "nothing-found", 2);
    return { profileId: p._id, gatorade, ors, flagged, clear };
  });
  return { t, ...ids };
}

const pooledCount = (t: Awaited<ReturnType<typeof setup>>["t"]) =>
  t.run(async (ctx) => (await ctx.db.query("aggregates").collect()).reduce((n, r) => n + r.helped + r.neutral + r.hurt, 0));

describe("a good outcome for something Villi flagged", () => {
  it("asks first: flagged item with helped or no change, not worse, not an unflagged item", async () => {
    const { t, flagged, clear } = await setup();
    const check = (outcome: "helped" | "neutral" | "hurt", answerId: Id<"answers">) =>
      t.query(api.logs.guidanceCheck, { anonId, outcome, answerId });
    expect(await check("helped", flagged)).toEqual({ item: "gatorade", why: "gatorade verdict", source: "check" });
    expect(await check("neutral", flagged)).not.toBeNull();
    expect(await check("hurt", flagged)).toBeNull();
    expect(await check("helped", clear)).toBeNull();
    // A typed name finds the flagged check too.
    expect(await t.query(api.logs.guidanceCheck, { anonId, outcome: "helped", itemText: "Gatorade" })).not.toBeNull();
    expect(await t.query(api.logs.guidanceCheck, { anonId, outcome: "helped", itemText: "water" })).toBeNull();
  });

  it("saves it for the author only and never moves the shared counts", async () => {
    const { t, flagged } = await setup();
    const logId = await t.mutation(api.logs.create, { anonId, outcome: "helped", answerId: flagged });
    const mine = (await t.query(api.logs.listMine, { anonId })).find((l) => l._id === logId)!;
    expect(mine.status).toBe("private");
    expect(mine.nudge).toBe(AGAINST_GUIDANCE_NUDGE);

    // Even if the moderator would share it, it stays private.
    await t.mutation(internal.moderation.applyLog, { logId, pooled: true, reason: null, nudge: null });
    const row = await t.run((ctx) => ctx.db.get("log_entries", logId));
    expect(row?.pooled).toBe(false);
    expect(row?.againstGuidance?.item).toBe("gatorade");
    expect(await pooledCount(t)).toBe(0);
  });

  it("still pools a worse outcome for the same item", async () => {
    const { t, flagged } = await setup();
    const logId = await t.mutation(api.logs.create, { anonId, outcome: "hurt", answerId: flagged });
    await t.mutation(internal.moderation.applyLog, { logId, pooled: true, reason: null, nudge: null });
    expect((await t.run((ctx) => ctx.db.get("log_entries", logId)))?.pooled).toBe(true);
    expect(await pooledCount(t)).toBe(1);
  });

  it("catches a typed name once moderation finds its catalog item", async () => {
    const { t, gatorade } = await setup();
    const logId = await t.mutation(api.logs.create, { anonId, outcome: "neutral", itemText: "the blue sports drink" });
    expect((await t.run((ctx) => ctx.db.get("log_entries", logId)))?.againstGuidance).toBeUndefined();
    await t.mutation(internal.moderation.applyLog, { logId, itemId: gatorade, pooled: true, reason: null, nudge: null });
    expect((await t.run((ctx) => ctx.db.get("log_entries", logId)))?.pooled).toBe(false);
    expect(await pooledCount(t)).toBe(0);
  });

  it("follows the latest check: a newer answer without a flag clears it", async () => {
    const { t, gatorade, profileId } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("answers", {
        profileId,
        kind: "scan",
        input: { text: "gatorade" },
        status: "final",
        identified: "gatorade",
        itemId: gatorade,
        toolTrace: [],
        final: { state: "nothing-found", verdict: "Nothing in the sources I checked raised a concern." },
        createdAt: 3,
      }),
    );
    expect(await t.query(api.logs.guidanceCheck, { anonId, outcome: "helped", itemText: "gatorade" })).toBeNull();
  });
});
