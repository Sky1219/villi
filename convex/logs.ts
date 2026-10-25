import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { outcomeValidator } from "./schema";
import { requireProfile } from "./profiles";
import { retrier } from "./lib/retrier";
import { cardFor, scanWarningSigns } from "./lib/warningSigns";
import { AGAINST_GUIDANCE_NUDGE, isGoodOutcome, sameItem, type GuidanceConflict } from "./lib/guidance";
import { medReviewRows } from "./meds";

const stripCites = (t: string) => t.replace(/\s*\[(G|L|C|T):[^\]]+\]/g, "").trim();

type FinalLike = { state?: string; verdict?: string } | undefined;

// The latest finished check of each item decides: a later "nothing found" replaces an
// earlier flag. Returns the flagged ones that match.
async function flaggedChecks(ctx: QueryCtx, profileId: Id<"profiles">, match: (a: Doc<"answers">) => boolean) {
  const recent = await ctx.db
    .query("answers")
    .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
    .order("desc")
    .take(50);
  const seen = new Set<string>();
  for (const a of recent) {
    if (a.status !== "final" || a.kind !== "scan" || a.input.saw || !match(a)) continue;
    const key = a.itemId ?? a.identified ?? a.input.text ?? a._id;
    if (seen.has(key)) continue;
    seen.add(key);
    const f = a.final as FinalLike;
    if (f?.state === "flagged") {
      return { item: a.identified ?? a.input.text ?? "this item", why: stripCites(f.verdict ?? ""), source: "check" as const };
    }
  }
  return null;
}

// Is this log a good or neutral outcome for something Villi flagged for this person's
// anatomy? By the answer it was logged from, the catalog item, or the typed name
// against flagged checks and flagged medicines in the list review.
export async function guidanceConflict(
  ctx: QueryCtx,
  profile: Doc<"profiles">,
  e: { outcome: string; answerId?: Id<"answers">; itemId?: Id<"items">; itemText?: string },
): Promise<GuidanceConflict | null> {
  if (!isGoodOutcome(e.outcome)) return null;
  if (e.answerId) {
    const a = await ctx.db.get("answers", e.answerId);
    const root = a?.kind === "followup" && a.parentId ? await ctx.db.get("answers", a.parentId) : a;
    const f = root?.final as FinalLike;
    if (root && root.profileId === profile._id && root.status === "final" && f?.state === "flagged") {
      return { item: root.identified ?? root.input.text ?? "this item", why: stripCites(f.verdict ?? ""), source: "check" };
    }
    if (root?.itemId) return await flaggedChecks(ctx, profile._id, (x) => x.itemId === root.itemId);
    return null;
  }
  if (e.itemId) {
    const byItem = await flaggedChecks(ctx, profile._id, (x) => x.itemId === e.itemId);
    if (byItem) return byItem;
  }
  const text = e.itemText;
  if (!text) return null;
  const byName = await flaggedChecks(ctx, profile._id, (x) => [x.identified, x.input.text].some((n) => !!n && sameItem(text, n)));
  if (byName) return byName;
  const med = (await medReviewRows(ctx, profile)).find((r) => r.state === "flagged" && sameItem(text, r.name));
  return med ? { item: med.name, why: med.flags.map((f) => f.text).join(" "), source: "review" } : null;
}

// Asked before saving, so the app can say "Are you sure?". The server decides again on save.
export const guidanceCheck = query({
  args: {
    anonId: v.string(),
    outcome: outcomeValidator,
    answerId: v.optional(v.id("answers")),
    itemText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    return await guidanceConflict(ctx, profile, {
      outcome: args.outcome,
      answerId: args.answerId,
      itemText: args.itemText?.trim().slice(0, 120),
    });
  },
});

// Inserts a log entry and schedules its moderation. Every log goes through here.
export async function insertLog(
  ctx: MutationCtx,
  profile: Doc<"profiles">,
  e: {
    outcome: Doc<"log_entries">["outcome"];
    itemId?: Id<"items">;
    itemText?: string;
    answerId?: Id<"answers">;
    note?: string;
    synthetic?: boolean;
    againstGuidance?: GuidanceConflict | null;
  },
) {
  const note = e.note?.trim().slice(0, 280) || undefined;
  const scan = scanWarningSigns(note);
  const logId = await ctx.db.insert("log_entries", {
    profileId: profile._id,
    anatomySnapshot: profile.anatomy,
    anatomyKey: profile.anatomyKey,
    itemId: e.itemId,
    itemText: e.itemText,
    answerId: e.answerId,
    outcome: e.outcome,
    note,
    warning: scan.level ? { level: scan.level, signs: scan.signs } : undefined,
    againstGuidance: e.againstGuidance ?? undefined,
    pooled: null,
    synthetic: e.synthetic ?? false,
    createdAt: Date.now(),
  });
  const runId = await retrier.run(ctx, internal.moderation.moderateLog, { logId }, {
    onComplete: internal.moderation.onLogModerated,
  });
  await ctx.db.patch("log_entries", logId, { moderationRunId: runId });
  return logId;
}

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

    // Decided here, not by the client: a flagged item's good outcome never reaches the pool.
    const againstGuidance = await guidanceConflict(ctx, profile, { outcome: args.outcome, answerId: args.answerId, itemId, itemText });
    return await insertLog(ctx, profile, { outcome: args.outcome, itemId, itemText, answerId: args.answerId, note: args.note, againstGuidance });
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
        // Against guidance: private from the moment it's saved, whatever moderation is doing.
        status: r.againstGuidance ? "private" : r.pooled === null ? "checking" : r.pooled ? "shared" : "private",
        nudge: r.againstGuidance ? AGAINST_GUIDANCE_NUDGE : (r.nudgeUser ?? null),
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});
