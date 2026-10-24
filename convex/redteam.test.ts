/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { lintAnswer, type CitationRegistry } from "./lib/safety";
import type { Answer } from "./lib/answerSchema";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";
import { SEED_ITEMS } from "./lib/seedData";
import { checkSwap } from "./lib/swapCheck";
import corpus from "../data/guidelines.json";
import { installFetch, text } from "../testing/fetchMock";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const base: Answer = {
  state: "flagged",
  verdict: "This is a sugary drink with little salt.",
  why: [{ claim: "Sports drinks are low in sodium compared with an SBS ORS.", citation: "[G:aga-sbs#fluids-sports-drinks]" }],
  swapToAskAbout: null,
  community: null,
  careTeamAnswers: [],
  personal: [],
  diagram: null,
  sourcesChecked: ["Parrish & DiBaise 2017"],
  ask: "ASK: Would an oral rehydration solution suit this anatomy better than a sports drink?",
  confidence: "medium",
  unidentified: false,
};

const reg: CitationRegistry = {
  guidelineIds: ["aga-sbs#fluids-sports-drinks"],
  labelSections: [],
  communityTotals: [13, 40],
  careTeamIds: [],
  allowedStrengths: [],
  communityCells: [
    { key: "end-jejunostomy", total: 13, counts: [5, 5, 3] },
    { key: "other", total: 40, counts: [20, 12, 8] },
  ],
};

const withClaim = (claim: string, citation: string): Answer => ({ ...base, why: [...base.why, { claim, citation }] });
const kept = (a: Answer) => lintAnswer(a, reg).answer.why.length === a.why.length;

describe("community fraction numerator", () => {
  it("keeps a claim whose numbers match a retrieved cell for that anatomy", () => {
    expect(kept(withClaim("3 of 13 people with an end-jejunostomy logged it as worse.", "[C:3/13, end-jejunostomy (no colon)]"))).toBe(true);
    expect(kept(withClaim("8 of 40 people with other anatomies logged worse.", "[C:8/40, other anatomies]"))).toBe(true);
  });

  it("deletes a numerator that matches no retrieved count", () => {
    expect(kept(withClaim("9 of 13 people logged worse.", "[C:9/13, end-jejunostomy]"))).toBe(false);
  });

  it("deletes a right total cited for the wrong anatomy", () => {
    expect(kept(withClaim("20 of 40 people with an end-jejunostomy said it helped.", "[C:20/40, end-jejunostomy]"))).toBe(false);
  });

  it("deletes a claim whose own numbers differ from its citation's cell", () => {
    expect(kept(withClaim("7 of 13 people with an end-jejunostomy logged worse.", "[C:3/13, end-jejunostomy]"))).toBe(false);
  });
});

describe("swap source", () => {
  const swap = { text: "Ask whether an oral rehydration solution would suit better.", source: "community" as const, citation: "[G:aga-sbs#fluids-sports-drinks]" };
  it("relabels a community swap as a guideline swap when no swap group was retrieved", () => {
    const out = lintAnswer({ ...base, swapToAskAbout: swap }, reg).answer;
    expect(out.swapToAskAbout?.source).toBe("guideline");
  });
  it("keeps the community label when a swap group was retrieved", () => {
    const out = lintAnswer({ ...base, swapToAskAbout: swap }, { ...reg, communitySwaps: ["oral rehydration solution"] }).answer;
    expect(out.swapToAskAbout?.source).toBe("community");
  });
});

describe("sports drinks are roughly isotonic", () => {
  it("are seeded as isotonic and sugary, and the hypertonic chunk no longer claims them", () => {
    const sports = SEED_ITEMS.find((i) => i.canonicalName === "sports drink")!;
    expect(sports.attributes).toMatchObject({ tonicity: "isotonic", simpleSugar: true, lowSodium: true });
    const hyper = corpus.chunks.find((c) => c.locator === "fluids-hypertonic")!;
    expect(hyper.tags).not.toContain("sports-drink");
    const ors = SEED_ITEMS.find((i) => i.canonicalName === "oral rehydration solution")!;
    expect(checkSwap(sports, ors, JEJ).passed).toBe(true);
  });
});

describe("new profiles", () => {
  it("share at most 3 note-free entries in their first ten minutes; the rest wait for a re-check", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    retrierTest.register(t);
    const logIds = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        anonId: "overnight-new-profile-000000001",
        role: "patient",
        anatomy: JEJ,
        anatomyKey: anatomyKeyOf(JEJ),
        language: "en",
        clinicianDemoVerified: false,
        synthetic: false,
        createdAt: Date.now(),
      });
      const ids: Id<"log_entries">[] = [];
      for (let i = 0; i < 4; i++) {
        const itemId = await ctx.db.insert("items", { canonicalName: `drink ${i}`, category: "drink", attributes: {}, aliases: [], searchText: `drink ${i}`, synthetic: false });
        ids.push(
          await ctx.db.insert("log_entries", {
            profileId,
            anatomySnapshot: JEJ,
            anatomyKey: anatomyKeyOf(JEJ),
            itemId,
            outcome: "helped",
            pooled: null,
            synthetic: false,
            createdAt: Date.now() + i,
          }),
        );
      }
      return ids;
    });
    for (const logId of logIds) {
      await t.mutation(internal.moderation.applyLog, { logId, pooled: true, reason: null, nudge: null });
    }
    const pooled = async () => t.run(async (ctx) => Promise.all(logIds.map(async (id) => (await ctx.db.get("log_entries", id))!.pooled)));
    expect(await pooled()).toEqual([true, true, true, null]);

    // After the window, the scheduled re-check runs the normal moderation pass.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await pooled()).toEqual([true, true, true, true]);
  });
});

describe("catalog pollution", () => {
  const canon = (name: string) =>
    text({
      matchCanonicalName: null,
      canonicalName: name,
      category: "pill",
      tonicity: "none",
      simpleSugar: false,
      sugarAlcohol: null,
      caffeine: false,
      releaseForm: "immediate-release",
      thickening: false,
      lactose: false,
    });

  it("never adds a pill with no FDA label to the catalog", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    installFetch({ claude: [canon("zorblatrin")] });
    const t = convexTest(schema, modules);
    const out = await t.action(internal.canonicalize.run, { text: "Zorblatrin 20 mg" });
    expect(out).toMatchObject({ itemId: null, path: "unlisted", attributes: {} });
    expect(await t.run(async (ctx) => (await ctx.db.query("items").take(5)).length)).toBe(0);
  });

  it("still adds a pill that has a label", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    installFetch({
      claude: [canon("zorbamine")],
      fda: [{ match: "label.json", body: { results: [{ id: "spl-1", effective_time: "20250101", openfda: { brand_name: ["Zorbamine"], generic_name: ["zorbamine"], route: ["ORAL"] } }] } }],
    });
    const t = convexTest(schema, modules);
    const out = await t.action(internal.canonicalize.run, { text: "Zorbamine" });
    expect(out.path).toBe("created");
    expect(out.itemId).not.toBeNull();
  });
});
