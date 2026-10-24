import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { anatomyValidator, outcomeValidator } from "./schema";
import { anatomyKeyOf, type AnatomyKey } from "./lib/anatomy";
import { applyPooledTransition } from "./community";
import {
  FATHER,
  PEER,
  SEED_CARE_TEAM,
  SEED_ITEMS,
  SEED_QUESTIONS,
  SEED_SWAPS,
  SYNTHETIC_GROUPS,
  noteFor,
  outcomeOdds,
} from "./lib/seedData";
import { checkSwap } from "./lib/swapCheck";

const SEED_ITEM_BY_NAME = new Map(SEED_ITEMS.map((s) => [s.canonicalName, s]));

// Deterministic PRNG so re-seeding produces the same community.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYNTHETIC_TABLES = ["log_entries", "swaps", "care_team_answers", "questions"] as const;

// Deletes one batch of synthetic rows; returns how many were deleted.
export const clearSyntheticBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    for (const table of SYNTHETIC_TABLES) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_synthetic", (q) => q.eq("synthetic", true))
        .take(400);
      for (const row of rows) {
        if (table === "swaps") {
          const votes = await ctx.db.query("swap_votes").withIndex("by_swapId_and_profileId", (q) => q.eq("swapId", row._id as Id<"swaps">)).take(200);
          for (const vote of votes) await ctx.db.delete("swap_votes", vote._id);
        }
        if (table === "log_entries") {
          const e = row as unknown as { itemId: Id<"items">; anatomyKey: string; outcome: "helped" | "neutral" | "hurt"; pooled: boolean | null };
          if (e.pooled === true) await applyPooledTransition(ctx, { ...e, synthetic: true }, -1);
        }
        await ctx.db.delete(table, row._id);
        deleted++;
      }
      if (deleted >= 400) return deleted;
    }
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_synthetic", (q) => q.eq("synthetic", true))
      .take(100);
    for (const p of profiles) {
      const meds = await ctx.db.query("meds").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(50);
      for (const m of meds) await ctx.db.delete("meds", m._id);
      await ctx.db.delete("profiles", p._id);
      deleted++;
    }
    return deleted;
  },
});

export const upsertItems = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ids: Record<string, Id<"items">> = {};
    for (const item of SEED_ITEMS) {
      const doc = {
        ...item,
        searchText: [item.canonicalName, ...item.aliases].join(" "),
        synthetic: true,
      };
      const existing = await ctx.db
        .query("items")
        .withIndex("by_canonicalName", (q) => q.eq("canonicalName", item.canonicalName))
        .unique();
      if (existing) {
        await ctx.db.patch("items", existing._id, doc);
        ids[item.canonicalName] = existing._id;
      } else {
        ids[item.canonicalName] = await ctx.db.insert("items", doc);
      }
    }
    return ids;
  },
});

export const insertProfiles = internalMutation({
  args: {
    profiles: v.array(
      v.object({
        anatomy: anatomyValidator,
        role: v.union(v.literal("patient"), v.literal("caregiver"), v.literal("clinician")),
        templateKey: v.optional(v.string()),
        meds: v.array(v.object({ name: v.string(), genericName: v.string(), dosageForm: v.string() })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ids: Id<"profiles">[] = [];
    for (const p of args.profiles) {
      const id = await ctx.db.insert("profiles", {
        anonId: `synthetic-${crypto.randomUUID()}`,
        role: p.role,
        anatomy: p.anatomy,
        anatomyKey: anatomyKeyOf(p.anatomy),
        language: "en",
        // The demo caregiver is a son or daughter checking for a parent, like the builder.
        caresFor: p.role === "caregiver" ? "parent" : undefined,
        clinicianDemoVerified: p.role === "clinician",
        synthetic: true,
        templateKey: p.templateKey,
        createdAt: Date.now(),
      });
      for (const m of p.meds) await ctx.db.insert("meds", { profileId: id, ...m, addedAt: Date.now() });
      ids.push(id);
    }
    return ids;
  },
});

export const insertLogs = internalMutation({
  args: {
    rows: v.array(
      v.object({
        profileId: v.id("profiles"),
        itemId: v.id("items"),
        outcome: outcomeValidator,
        note: v.optional(v.string()),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const r of args.rows) {
      const p = await ctx.db.get("profiles", r.profileId);
      if (!p) continue;
      await ctx.db.insert("log_entries", {
        ...r,
        anatomySnapshot: p.anatomy,
        anatomyKey: p.anatomyKey,
        // Seed rows are written pre-moderated; real rows always start null.
        pooled: true,
        synthetic: true,
      });
      await applyPooledTransition(ctx, { itemId: r.itemId, anatomyKey: p.anatomyKey, outcome: r.outcome, synthetic: true }, 1);
    }
    return null;
  },
});

export const insertCommunity = internalMutation({
  args: {
    itemIds: v.record(v.string(), v.id("items")),
    byAnatomy: v.record(v.string(), v.array(v.id("profiles"))),
    clinicians: v.array(v.id("profiles")),
  },
  handler: async (ctx, args) => {
    const pick = (key: AnatomyKey, i: number) => {
      const list = args.byAnatomy[key];
      return list[i % list.length];
    };
    let i = 0;
    for (const s of SEED_SWAPS) {
      const profileId = pick(s.anatomy, i++);
      const p = (await ctx.db.get("profiles", profileId))!;
      // Seed swaps pass the same guideline check as real ones, or they aren't seeded.
      const check = checkSwap(SEED_ITEM_BY_NAME.get(s.insteadOf)!, SEED_ITEM_BY_NAME.get(s.use)!, p.anatomy);
      if (!check.passed) continue;
      await ctx.db.insert("swaps", {
        profileId,
        anatomySnapshot: p.anatomy,
        anatomyKey: p.anatomyKey,
        insteadOfItemId: args.itemIds[s.insteadOf],
        useItemId: args.itemIds[s.use],
        note: s.note,
        pooled: true,
        guidelineCheck: { passed: true, citations: s.citations },
        upvotes: 2 + ((i * 7) % 23),
        clinicianEndorsements: s.endorsed ? [args.clinicians[i % args.clinicians.length]] : [],
        synthetic: true,
        createdAt: Date.now() - i * 3_600_000,
      });
    }
    for (const c of SEED_CARE_TEAM) {
      const profileId = pick(c.anatomy, i++);
      const p = (await ctx.db.get("profiles", profileId))!;
      await ctx.db.insert("care_team_answers", {
        profileId,
        anatomySnapshot: p.anatomy,
        anatomyKey: p.anatomyKey,
        questionText: c.question,
        itemId: c.item ? args.itemIds[c.item] : undefined,
        professionalType: c.professional,
        answerText: c.answer,
        resultingChange: c.change ?? (c.item && SEED_ITEM_BY_NAME.get(c.item)?.category === "pill" ? "pending" : "no_change"),
        pooled: true,
        clinicianEndorsements: c.endorsed ? [args.clinicians[i % args.clinicians.length]] : [],
        synthetic: true,
        createdAt: Date.now() - i * 3_600_000,
      });
    }
    const keys = Object.keys(args.byAnatomy) as AnatomyKey[];
    for (const [n, text] of SEED_QUESTIONS.entries()) {
      await ctx.db.insert("questions", {
        profileId: pick(keys[n % keys.length], n),
        text,
        context: {},
        resolved: false,
        status: n % 3 === 0 ? "asked" : "open",
        synthetic: true,
        createdAt: Date.now() - n * 7_200_000,
      });
    }
    return null;
  },
});

// `npm run seed` -> `npx convex run seed:run`. Idempotent: clears synthetic
// rows, keeps real ones, re-embeds only changed guideline chunks.
export const run = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, unknown>> => {
    const started = Date.now();
    const corpus: { inserted: number; updated: number; removed: number } = await ctx.runMutation(internal.guidelines.syncCorpus, {});
    const embed: { embedded: number; skipped: string | null } = await ctx.runAction(internal.guidelines.embedMissing, {});

    let cleared = 0;
    for (;;) {
      const n: number = await ctx.runMutation(internal.seed.clearSyntheticBatch, {});
      cleared += n;
      if (n === 0) break;
    }

    const itemIds: Record<string, Id<"items">> = await ctx.runMutation(internal.seed.upsertItems, {});
    const rand = mulberry32(1013);

    const [fatherId, peerId]: Id<"profiles">[] = await ctx.runMutation(internal.seed.insertProfiles, {
      profiles: [
        { anatomy: FATHER.anatomy, role: "caregiver", templateKey: "father", meds: FATHER.meds },
        { anatomy: PEER.anatomy, role: "patient", templateKey: "peer", meds: PEER.meds },
      ],
    });

    const byAnatomy: Record<string, Id<"profiles">[]> = {};
    for (const g of SYNTHETIC_GROUPS) {
      const profiles = Array.from({ length: g.count }, (_, i) => ({
        anatomy: g.anatomies[i % g.anatomies.length],
        role: (rand() < 0.3 ? "caregiver" : "patient") as "patient" | "caregiver",
        meds: [],
      }));
      byAnatomy[g.key] = await ctx.runMutation(internal.seed.insertProfiles, { profiles });
    }
    const clinicians: Id<"profiles">[] = await ctx.runMutation(internal.seed.insertProfiles, {
      profiles: Array.from({ length: 5 }, () => ({
        anatomy: { colonInContinuity: true, stomaType: "none" as const, bowelLengthBand: ">200cm" as const },
        role: "clinician" as const,
        meds: [],
      })),
    });

    // ~25 distinct items per synthetic profile -> ~1,500 log entries.
    type Row = { profileId: Id<"profiles">; itemId: Id<"items">; outcome: "helped" | "neutral" | "hurt"; note?: string; createdAt: number };
    const rows: Row[] = [];
    for (const g of SYNTHETIC_GROUPS) {
      for (const profileId of byAnatomy[g.key]) {
        const shuffled = [...SEED_ITEMS].sort(() => rand() - 0.5).slice(0, 25);
        for (const item of shuffled) {
          const [h, n] = outcomeOdds(item, g.key);
          const r = rand();
          const outcome = r < h ? "helped" : r < h + n ? "neutral" : "hurt";
          rows.push({
            profileId,
            itemId: itemIds[item.canonicalName],
            outcome,
            note: noteFor(item, outcome, rand()),
            createdAt: Date.now() - Math.floor(rand() * 90 * 86_400_000),
          });
        }
      }
    }
    for (let i = 0; i < rows.length; i += 300) {
      await ctx.runMutation(internal.seed.insertLogs, { rows: rows.slice(i, i + 300) });
    }

    await ctx.runMutation(internal.seed.insertCommunity, { itemIds, byAnatomy, clinicians });

    return {
      corpus,
      embeddings: embed,
      clearedSyntheticRows: cleared,
      items: Object.keys(itemIds).length,
      profiles: 2 + Object.values(byAnatomy).flat().length + clinicians.length,
      templates: { fatherId, peerId },
      logEntries: rows.length,
      swaps: SEED_SWAPS.length,
      careTeamAnswers: SEED_CARE_TEAM.length,
      questions: SEED_QUESTIONS.length,
      seconds: (Date.now() - started) / 1000,
    };
  },
});
