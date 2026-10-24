import { v } from "convex/values";
import { internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireProfile } from "./profiles";
import type { Id } from "./_generated/dataModel";
import { ANATOMY_KEYS, ANATOMY_LABELS, type AnatomyKey } from "./lib/anatomy";

type Outcome = "helped" | "neutral" | "hurt";

// The only path that changes counters. Call it in the same mutation that flips
// a log entry's `pooled` to true (delta 1) or back from true (delta -1).
export async function applyPooledTransition(
  ctx: MutationCtx,
  entry: { itemId: Id<"items">; anatomyKey: string; outcome: Outcome; synthetic: boolean },
  delta: 1 | -1,
) {
  const row = await ctx.db
    .query("aggregates")
    .withIndex("by_itemId_and_anatomyKey", (q) =>
      q.eq("itemId", entry.itemId).eq("anatomyKey", entry.anatomyKey),
    )
    .unique();
  const synth = entry.synthetic ? delta : 0;
  if (!row) {
    if (delta < 0) return;
    await ctx.db.insert("aggregates", {
      itemId: entry.itemId,
      anatomyKey: entry.anatomyKey,
      helped: 0,
      neutral: 0,
      hurt: 0,
      [entry.outcome]: 1,
      syntheticCount: synth,
    });
    return;
  }
  await ctx.db.patch("aggregates", row._id, {
    [entry.outcome]: Math.max(0, row[entry.outcome] + delta),
    syntheticCount: Math.max(0, row.syntheticCount + synth),
  });
}

export type StratifiedCounts = {
  itemId: Id<"items">;
  anatomyKey: string;
  anatomyLabel: string;
  matchingAnatomy: { helped: number; neutral: number; hurt: number; total: number };
  other: { helped: number; neutral: number; hurt: number; total: number };
  byAnatomy: { anatomyKey: string; label: string; helped: number; neutral: number; hurt: number; total: number }[];
  includesSynthetic: boolean;
};

// O(1) per anatomy group: at most four counter rows per item.
export async function stratifiedCounts(
  ctx: QueryCtx,
  itemId: Id<"items">,
  anatomyKey: string,
): Promise<StratifiedCounts> {
  const zero = () => ({ helped: 0, neutral: 0, hurt: 0, total: 0 });
  const matching = zero();
  const other = zero();
  const byAnatomy: StratifiedCounts["byAnatomy"] = [];
  let synthetic = 0;
  for (const key of ANATOMY_KEYS) {
    const row = await ctx.db
      .query("aggregates")
      .withIndex("by_itemId_and_anatomyKey", (q) => q.eq("itemId", itemId).eq("anatomyKey", key))
      .unique();
    if (!row) continue;
    const total = row.helped + row.neutral + row.hurt;
    byAnatomy.push({ anatomyKey: key, label: ANATOMY_LABELS[key], helped: row.helped, neutral: row.neutral, hurt: row.hurt, total });
    synthetic += row.syntheticCount;
    const target = key === anatomyKey ? matching : other;
    target.helped += row.helped;
    target.neutral += row.neutral;
    target.hurt += row.hurt;
    target.total += total;
  }
  return {
    itemId,
    anatomyKey,
    anatomyLabel: ANATOMY_LABELS[anatomyKey as AnatomyKey] ?? anatomyKey,
    matchingAnatomy: matching,
    other,
    byAnatomy,
    includesSynthetic: synthetic > 0,
  };
}

export const counts = internalQuery({
  args: { itemId: v.id("items"), anatomyKey: v.string() },
  handler: async (ctx, args) => stratifiedCounts(ctx, args.itemId, args.anatomyKey),
});

// query_community / query_my_log back-ends for the agent. Look up an item by name first.
export const findItem = internalQuery({
  args: { name: v.string(), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const exact = await ctx.db
      .query("items")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", args.name.toLowerCase().trim()))
      .unique();
    if (exact) return exact;
    const hits = await ctx.db
      .query("items")
      .withSearchIndex("search_text", (q) => q.search("searchText", args.name))
      .take(5);
    return hits[0] ?? null;
  },
});

export const communityForItem = internalQuery({
  args: { name: v.string(), anatomyKey: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.toLowerCase().trim();
    let item = await ctx.db
      .query("items")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", name))
      .unique();
    if (!item) {
      const hits = await ctx.db
        .query("items")
        .withSearchIndex("search_text", (q) => q.search("searchText", args.name))
        .take(1);
      item = hits[0] ?? null;
    }
    if (!item) return null;
    return { item: { canonicalName: item.canonicalName, category: item.category }, counts: await stratifiedCounts(ctx, item._id, args.anatomyKey) };
  },
});

export const myLogForItem = internalQuery({
  args: { profileId: v.id("profiles"), name: v.string() },
  handler: async (ctx, args) => {
    const hits = await ctx.db
      .query("items")
      .withSearchIndex("search_text", (q) => q.search("searchText", args.name))
      .take(3);
    const out: { item: string; outcome: string; when: number }[] = [];
    for (const item of hits) {
      const rows = await ctx.db
        .query("log_entries")
        .withIndex("by_profileId_and_itemId", (q) => q.eq("profileId", args.profileId).eq("itemId", item._id))
        .order("desc")
        .take(10);
      for (const r of rows) out.push({ item: item.canonicalName, outcome: r.outcome, when: r.createdAt });
    }
    return out;
  },
});

// query_swaps: structured fields only. Other users' free-text notes never reach the agent.
export const swapsForItem = internalQuery({
  args: { itemId: v.id("items"), anatomyKey: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("swaps")
      .withIndex("by_insteadOfItemId", (q) => q.eq("insteadOfItemId", args.itemId))
      .take(100);
    const pooled = rows.filter((r) => r.pooled === true && r.guidelineCheck?.passed);
    // Group by the item swapped to: counts are the evidence, not any one person's note.
    const groups = new Map<string, { useItemId: Id<"items">; sameAnatomy: number; total: number; clinicianEndorsed: number; upvotes: number; synthetic: boolean; citations: Set<string> }>();
    for (const r of pooled) {
      const g = groups.get(r.useItemId) ?? { useItemId: r.useItemId, sameAnatomy: 0, total: 0, clinicianEndorsed: 0, upvotes: 0, synthetic: false, citations: new Set<string>() };
      g.total++;
      if (r.anatomyKey === args.anatomyKey) g.sameAnatomy++;
      if (r.clinicianEndorsements.length) g.clinicianEndorsed++;
      g.upvotes += r.upvotes;
      g.synthetic ||= r.synthetic;
      r.guidelineCheck!.citations.forEach((c) => g.citations.add(c.replace(/^G:/, "")));
      groups.set(r.useItemId, g);
    }
    const out = [];
    for (const g of groups.values()) {
      const use = await ctx.db.get("items", g.useItemId);
      if (!use) continue;
      out.push({
        use: use.canonicalName,
        postedByYourAnatomy: g.sameAnatomy,
        postedTotal: g.total,
        clinicianEndorsed: g.clinicianEndorsed,
        upvotes: g.upvotes,
        includesSynthetic: g.synthetic,
        guidelineChunkIds: Array.from(g.citations),
      });
    }
    return out.sort((a, b) => b.postedByYourAnatomy - a.postedByYourAnatomy || b.clinicianEndorsed - a.clinicianEndorsed || b.upvotes - a.upvotes).slice(0, 5);
  },
});

// query_care_team_answers: moderated reports only, same anatomy first.
export const careTeamForItem = internalQuery({
  args: { itemId: v.id("items"), anatomyKey: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("care_team_answers")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .take(50);
    return rows
      .filter((r) => r.pooled === true)
      .sort((a, b) => Number(b.anatomyKey === args.anatomyKey) - Number(a.anatomyKey === args.anatomyKey) || b.clinicianEndorsements.length - a.clinicianEndorsements.length)
      .slice(0, 4)
      .map((r) => ({
        id: r._id as string,
        professionalType: r.professionalType,
        question: r.questionText,
        report: r.answerText,
        reporterAnatomy: ANATOMY_LABELS[r.anatomyKey as AnatomyKey] ?? r.anatomyKey,
        sameAnatomy: r.anatomyKey === args.anatomyKey,
        clinicianEndorsed: r.clinicianEndorsements.length > 0,
        synthetic: r.synthetic,
      }));
  },
});

export const countsByItemId = internalQuery({
  args: { itemId: v.id("items"), anatomyKey: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get("items", args.itemId);
    if (!item) return null;
    return { item: { canonicalName: item.canonicalName, category: item.category }, counts: await stratifiedCounts(ctx, item._id, args.anatomyKey) };
  },
});

// Live on the answer card: a log from another device updates these counts in place.
export const liveCounts = query({
  args: { anonId: v.string(), itemId: v.id("items") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const item = await ctx.db.get("items", args.itemId);
    if (!item) return null;
    return { canonicalName: item.canonicalName, ...(await stratifiedCounts(ctx, item._id, profile.anatomyKey)) };
  },
});
