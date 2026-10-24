/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { applyPooledTransition } from "./community";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");

const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const COLON: Anatomy = { colonInContinuity: true, stomaType: "none", bowelLengthBand: "100-200cm" };

describe("stratified counts", () => {
  it("counts only pooled entries, split by anatomy, and tracks synthetic rows", async () => {
    const t = convexTest(schema, modules);
    const { itemId } = await t.run(async (ctx) => {
      const itemId = await ctx.db.insert("items", {
        canonicalName: "sports drink",
        category: "drink",
        attributes: {},
        aliases: [],
        searchText: "sports drink",
        synthetic: false,
      });
      const mk = (a: Anatomy) =>
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
      const jej = await mk(JEJ);
      const colon = await mk(COLON);
      const log = async (p: typeof jej, a: Anatomy, outcome: "helped" | "neutral" | "hurt", pooled: boolean | null, synthetic: boolean) => {
        await ctx.db.insert("log_entries", {
          profileId: p,
          anatomySnapshot: a,
          anatomyKey: anatomyKeyOf(a),
          itemId,
          outcome,
          pooled,
          synthetic,
          createdAt: 0,
        });
        if (pooled) await applyPooledTransition(ctx, { itemId, anatomyKey: anatomyKeyOf(a), outcome, synthetic }, 1);
      };
      // End-jejunostomy: 3 hurt, 1 helped pooled; 1 hurt waiting on moderation; 1 hurt rejected.
      await log(jej, JEJ, "hurt", true, true);
      await log(jej, JEJ, "hurt", true, false);
      await log(jej, JEJ, "hurt", true, false);
      await log(jej, JEJ, "helped", true, false);
      await log(jej, JEJ, "hurt", null, false);
      await log(jej, JEJ, "hurt", false, false);
      // Colon in continuity: 1 helped, 1 neutral.
      await log(colon, COLON, "helped", true, false);
      await log(colon, COLON, "neutral", true, false);
      // A pooled entry later reversed by moderation.
      await log(colon, COLON, "hurt", true, false);
      await applyPooledTransition(ctx, { itemId, anatomyKey: "colon-in-continuity", outcome: "hurt", synthetic: false }, -1);
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
});
