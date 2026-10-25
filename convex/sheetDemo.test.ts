/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const ANATOMY = { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "<100cm" } as const;

describe("sheet demo flag", () => {
  it("marks a profile started from a demo, and only that one", async () => {
    const t = convexTest(schema, modules);
    for (const anonId of ["real-device-0001-aaaa", "demo-device-0002-bbbb"]) {
      await t.mutation(api.profiles.upsert, { anonId, role: "caregiver", language: "en", anatomy: ANATOMY });
    }
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("profiles").withIndex("by_anonId", (q) => q.eq("anonId", "demo-device-0002-bbbb")).unique())!;
      await ctx.db.patch("profiles", p._id, { demoClone: true });
    });
    expect((await t.query(api.sheet.get, { anonId: "real-device-0001-aaaa" })).demo).toBe(false);
    expect((await t.query(api.sheet.get, { anonId: "demo-device-0002-bbbb" })).demo).toBe(true);
  });
});
