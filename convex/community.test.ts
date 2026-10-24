/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { applyPooledTransition } from "./community";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");

const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const COLON: Anatomy = { colonInContinuity: true, stomaType: "none", bowelLengthBand: "100-200cm" };

type Outcome = "helped" | "neutral" | "hurt";

async function setup(ctx: MutationCtx) {
  const itemId = await ctx.db.insert("items", {
    canonicalName: "sports drink",
    category: "drink",
    attributes: {},
    aliases: [],
    searchText: "sports drink",
    synthetic: false,
  });
  const person = (a: Anatomy) =>
    ctx.db.insert("profiles", {
      anonId: crypto.randomUUID(),
      role: "patient",
      anatomy: a,
      anatomyKey: anatomyKeyOf(a),
      language: "en",
      clinicianDemoVerified: false,
      synthetic: false,
      createdAt: 0,
    });
  // Inserts a log and, when pooled, applies the counter transition like moderation does.
  const log = async (profileId: Id<"profiles">, a: Anatomy, outcome: Outcome, pooled: boolean | null, synthetic: boolean, createdAt = 0) => {
    const id = await ctx.db.insert("log_entries", {
      profileId,
      anatomySnapshot: a,
      anatomyKey: anatomyKeyOf(a),
      itemId,
      outcome,
      pooled: null,
      synthetic,
      createdAt,
    });
    if (pooled) {
      await applyPooledTransition(ctx, { ...(await ctx.db.get("log_entries", id))!, itemId }, 1);
      await ctx.db.patch("log_entries", id, { pooled: true });
    } else if (pooled === false) {
      await ctx.db.patch("log_entries", id, { pooled: false });
    }
    return id;
  };
  return { itemId, person, log };
}

describe("stratified counts", () => {
  it("counts only pooled entries, split by anatomy, and tracks synthetic rows", async () => {
    const t = convexTest(schema, modules);
    const { itemId } = await t.run(async (ctx) => {
      const { itemId, person, log } = await setup(ctx);
      // End-jejunostomy: 3 hurt, 1 helped pooled; 1 hurt waiting on moderation; 1 hurt rejected.
      await log(await person(JEJ), JEJ, "hurt", true, true);
      await log(await person(JEJ), JEJ, "hurt", true, false);
      await log(await person(JEJ), JEJ, "hurt", true, false);
      await log(await person(JEJ), JEJ, "helped", true, false);
      await log(await person(JEJ), JEJ, "hurt", null, false);
      await log(await person(JEJ), JEJ, "hurt", false, false);
      // Colon in continuity: 1 helped, 1 neutral.
      await log(await person(COLON), COLON, "helped", true, false);
      await log(await person(COLON), COLON, "neutral", true, false);
      // A pooled entry later reversed by moderation.
      const reversed = await log(await person(COLON), COLON, "hurt", true, false);
      await applyPooledTransition(ctx, { ...(await ctx.db.get("log_entries", reversed))!, itemId }, -1);
      await ctx.db.patch("log_entries", reversed, { pooled: false });
      return { itemId };
    });

    const jej = await t.query(internal.community.counts, { itemId, anatomyKey: "end-jejunostomy" });
    expect(jej.matchingAnatomy).toEqual({ helped: 1, neutral: 0, hurt: 3, total: 4 });
    expect(jej.other).toEqual({ helped: 1, neutral: 1, hurt: 0, total: 2 });
    expect(jej.includesSynthetic).toBe(true);

    const colon = await t.query(internal.community.counts, { itemId, anatomyKey: "colon-in-continuity" });
    expect(colon.matchingAnatomy).toEqual({ helped: 1, neutral: 1, hurt: 0, total: 2 });
    expect(colon.byAnatomy.map((b) => b.anatomyKey).sort()).toEqual(["colon-in-continuity", "end-jejunostomy"]);
  });

  it("counts one person once: five logs from one profile, latest outcome wins", async () => {
    const t = convexTest(schema, modules);
    const { itemId, latest } = await t.run(async (ctx) => {
      const { itemId, person, log } = await setup(ctx);
      const me = await person(JEJ);
      await log(me, JEJ, "hurt", true, false, 1);
      await log(me, JEJ, "hurt", true, false, 2);
      await log(me, JEJ, "hurt", true, false, 3);
      await log(me, JEJ, "neutral", true, false, 4);
      const latest = await log(me, JEJ, "helped", true, false, 5);
      // An older entry pooled late (a slow moderation pass) does not take over.
      await log(me, JEJ, "hurt", true, false, 0);
      return { itemId, latest };
    });
    let jej = await t.query(internal.community.counts, { itemId, anatomyKey: "end-jejunostomy" });
    expect(jej.matchingAnatomy).toEqual({ helped: 1, neutral: 0, hurt: 0, total: 1 });

    // Unpooling the counted entry hands the count to the next latest (neutral at t=4).
    await t.run(async (ctx) => {
      await applyPooledTransition(ctx, { ...(await ctx.db.get("log_entries", latest))!, itemId }, -1);
      await ctx.db.patch("log_entries", latest, { pooled: false });
    });
    jej = await t.query(internal.community.counts, { itemId, anatomyKey: "end-jejunostomy" });
    expect(jej.matchingAnatomy).toEqual({ helped: 0, neutral: 1, hurt: 0, total: 1 });
  });
});
