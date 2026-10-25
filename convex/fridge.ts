import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireProfile } from "./profiles";
import { describeAnatomy } from "./lib/anatomy";
import { fridgeSheet } from "./lib/fridge";
import type { SwapItem } from "./lib/swapCheck";

// "Drinks that work for my anatomy", printable. Counts come from the pooled aggregates.
export const get = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_itemId_and_anatomyKey")
      .take(2000);
    const drinks = [];
    for (const r of rows) {
      if (r.anatomyKey !== profile.anatomyKey) continue;
      const item = await ctx.db.get("items", r.itemId);
      if (!item || item.category !== "drink") continue;
      const total = r.helped + r.neutral + r.hurt;
      drinks.push({
        name: item.canonicalName,
        tolerated: r.helped + r.neutral,
        total,
        synthetic: r.syntheticCount > 0,
        item: { canonicalName: item.canonicalName, category: item.category, attributes: item.attributes } as SwapItem,
      });
    }
    return {
      anatomyText: describeAnatomy(profile.anatomy),
      anatomyConfirmed: profile.anatomyConfirmed !== false,
      role: profile.role,
      caresFor: profile.caresFor ?? null,
      ...fridgeSheet(profile.anatomy, drinks),
    };
  },
});
