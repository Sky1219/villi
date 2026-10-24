import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
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
