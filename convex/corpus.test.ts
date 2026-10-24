/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import corpus from "../data/guidelines.json";
import { SEED_SWAPS } from "./lib/seedData";
import { corpusChunks } from "./guidelines";

const modules = import.meta.glob("./**/*.ts");
const sources = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const ids = new Set(corpus.chunks.map((c) => `${c.sourceId}#${c.locator}`));

describe("guideline corpus", () => {
  it("every chunk id cited anywhere in code or seed exists", () => {
    const cited = new Set<string>(SEED_SWAPS.flatMap((s) => s.citations.map((c) => c.replace(/^G:/, ""))));
    for (const [file, text] of Object.entries(sources)) {
      if (file.endsWith(".test.ts") || file.includes("_generated")) continue;
      for (const m of text.matchAll(/"((?:aga-sbs|pg139|pd-2017|remane-2025|sood-2013|hong-2021|who-ors|uoaa-2025)#[a-z0-9-]+)"/g)) cited.add(m[1]);
    }
    expect([...cited].filter((c) => !ids.has(c))).toEqual([]);
  });

  it("verified chunks say what they were checked against and where in the source", () => {
    for (const c of corpus.chunks as { locator: string; verified: boolean; verifiedAgainst?: string; section?: string }[]) {
      if (!c.verified) continue;
      expect({ c: c.locator, against: ["abstract", "full text"].includes(c.verifiedAgainst ?? ""), section: !!c.section }).toEqual({
        c: c.locator,
        against: true,
        section: true,
      });
    }
  });

  it("changed text drops the stored embedding so the next seed re-embeds it", async () => {
    const t = convexTest(schema, modules);
    const first = corpusChunks()[0];
    await t.run(async (ctx) => {
      await ctx.db.insert("guideline_chunks", { ...first, text: "old wording", contentHash: "stale", embedding: Array(1024).fill(0.1) });
      await ctx.db.insert("guideline_chunks", { ...first, chunkId: "aga-sbs#removed-chunk", embedding: Array(1024).fill(0.1) });
    });
    const res = await t.mutation(internal.guidelines.syncCorpus, {});
    expect(res.updated).toBe(1);
    expect(res.removed).toBe(1);
    const missing = await t.query(internal.guidelines.missingEmbeddings, {});
    expect(missing.length).toBe(corpus.chunks.length);
    const row = await t.run(async (ctx) =>
      ctx.db.query("guideline_chunks").withIndex("by_chunkId", (q) => q.eq("chunkId", first.chunkId)).unique(),
    );
    expect(row?.text).toBe(first.text);
    expect(row?.section).toBe(first.section);
  });
});
