import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { outcomeValidator } from "./schema";
import { requireProfile } from "./profiles";
import { retrier } from "./lib/retrier";
import { cardFor, scanWarningSigns } from "./lib/warningSigns";

// Lands with pooled: null; only the scheduled moderation pass can make it
// visible to others. The client can never set pooled, synthetic or itemId.
export const create = mutation({
  args: {
    anonId: v.string(),
    outcome: outcomeValidator,
    note: v.optional(v.string()),
    answerId: v.optional(v.id("answers")),
    itemText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    let itemId = undefined;
    if (args.answerId) {
      const a = await ctx.db.get("answers", args.answerId);
      if (!a || a.profileId !== profile._id) throw new ConvexError("Answer not found");
      itemId = a.itemId;
    }
    const itemText = args.itemText?.trim().slice(0, 120) || undefined;
    if (!itemId && !itemText) throw new ConvexError("What did you have?");

    const recent = await ctx.db
      .query("log_entries")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(20);
    if (recent.filter((r) => r.createdAt > Date.now() - 60_000).length >= 10) {
      throw new ConvexError("That's a lot of entries in a minute. Try again shortly.");
    }

    const note = args.note?.trim().slice(0, 280) || undefined;
    const scan = scanWarningSigns(note);
    const logId = await ctx.db.insert("log_entries", {
      profileId: profile._id,
      anatomySnapshot: profile.anatomy,
      anatomyKey: profile.anatomyKey,
      itemId,
      itemText,
      answerId: args.answerId,
      outcome: args.outcome,
      note,
      warning: scan.level ? { level: scan.level, signs: scan.signs } : undefined,
      pooled: null,
      synthetic: false,
      createdAt: Date.now(),
    });
    const runId = await retrier.run(ctx, internal.moderation.moderateLog, { logId }, {
      onComplete: internal.moderation.onLogModerated,
    });
    await ctx.db.patch("log_entries", logId, { moderationRunId: runId });
    return logId;
  },
});

// "Got it" on a warning card. The card stays until this is tapped.
export const ackWarning = mutation({
  args: { anonId: v.string(), logId: v.id("log_entries") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const log = await ctx.db.get("log_entries", args.logId);
    if (!log || log.profileId !== profile._id) throw new ConvexError("Entry not found");
    if (!log.warningAckAt) await ctx.db.patch("log_entries", log._id, { warningAckAt: Date.now() });
    return null;
  },
});

export const listMine = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const rows = await ctx.db
      .query("log_entries")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(20);
    const out = [];
    for (const r of rows) {
      const item = r.itemId ? await ctx.db.get("items", r.itemId) : null;
      const card = cardFor(r.warning ?? scanWarningSigns(r.note), r.outcome, item?.category ?? null);
      out.push({
        _id: r._id,
        answerId: r.answerId ?? null,
        // The warning card this entry shows until its author taps "Got it".
        card: card && !r.warningAckAt ? card : null,
        item: item?.canonicalName ?? r.itemText ?? "item",
        outcome: r.outcome,
        note: r.note ?? null,
        status: r.pooled === null ? "checking" : r.pooled ? "shared" : "private",
        nudge: r.nudgeUser ?? null,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});
