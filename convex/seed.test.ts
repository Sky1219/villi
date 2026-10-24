/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

describe("seed", () => {
  it("runs end to end, twice, and the demo clone gets its badged follow-up", { timeout: 120_000 }, async () => {
    const t = convexTest(schema, modules);
    const first = await t.action(internal.seed.run, {});
    expect(first).toMatchObject({ embeddings: { embedded: 0 } });
    // Re-seeding replaces synthetic rows and leaves the counters consistent.
    await t.action(internal.seed.run, {});
    const { outcomes, logs, aggregates } = await t.run(async (ctx) => ({
      outcomes: await ctx.db.query("care_outcomes").take(500),
      logs: await ctx.db.query("log_entries").take(5000),
      aggregates: await ctx.db.query("aggregates").take(500),
    }));
    // Every synthetic profile logs each item at most once, so counted people = pooled logs.
    const counted = aggregates.reduce((n, a) => n + a.helped + a.neutral + a.hurt, 0);
    expect(counted).toBe(logs.filter((l) => l.pooled === true).length);
    // Every seeded care-team answer about an item is a different person, so all of them count.
    const seededWithItem = await t.run(async (ctx) => (await ctx.db.query("care_team_answers").take(500)).filter((c) => c.itemId && c.resultingChange).length);
    expect(outcomes.reduce((n, o) => n + o.formulation_changed + o.dose_monitored + o.no_change + o.pending, 0)).toBe(seededWithItem);

    const anonId = "overnight-seed-clone-0000000001";
    await t.mutation(api.profiles.cloneDemo, { anonId, as: "father" });
    const due = await t.query(api.questions.followUpsDue, { anonId });
    expect(due).toHaveLength(1);
    expect(due[0].synthetic).toBe(true);
    const me = await t.query(api.profiles.me, { anonId });
    expect(me?.caresFor).toBe("parent");
    expect(me?.meds.length).toBe(5);
  });
});
