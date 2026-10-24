import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { outcomeValidator } from "./schema";
import { insertLog } from "./logs";
import { requireProfile } from "./profiles";
import { extractCitations } from "./lib/safety";
import { anatomyShort } from "./lib/anatomy";
import { reviewQuestion } from "./lib/medReview";
import { medReviewRows } from "./meds";
import type { Doc, Id } from "./_generated/dataModel";

// "Add to appointment sheet": copies the reviewed ASK line, never client text.
export const addFromAnswer = mutation({
  args: { anonId: v.string(), answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.profileId !== profile._id || a.status !== "final") throw new ConvexError("Answer not ready");
    const final = a.final as { ask: string; why: { citation: string }[] };
    const text = final.ask.replace(/^ASK:\s*/, "").trim();
    const existing = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(100);
    if (existing.some((q) => q.text === text)) return null;
    await ctx.db.insert("questions", {
      profileId: profile._id,
      text,
      context: {
        answerId: a._id,
        itemName: a.identified ?? a.input.text,
        citations: final.why.flatMap((w) => extractCitations(w.citation).map((c) => `${c.kind}:${c.ref}`)),
      },
      resolved: false,
      status: "open",
      synthetic: false,
      createdAt: Date.now(),
    });
    return null;
  },
});

// "Add a question to the sheet" from the medicine list review: a fixed
// template with the anatomy and the medicine's name, never a dose.
export const addFromReview = mutation({
  args: { anonId: v.string(), medId: v.id("meds") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const med = await ctx.db.get("meds", args.medId);
    if (!med || med.profileId !== profile._id) throw new ConvexError("Medicine not found");
    const text = reviewQuestion(med.name, anatomyShort(profile.anatomy));
    const existing = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(100);
    if (existing.some((q) => q.text === text)) return null;
    const row = (await medReviewRows(ctx, profile)).find((r) => r._id === med._id);
    await ctx.db.insert("questions", {
      profileId: profile._id,
      text,
      context: {
        itemName: med.name,
        citations: Array.from(new Set((row?.flags ?? []).flatMap((f) => f.citations.map((c) => c.key)))),
        fromReview: row?.state === "flagged",
      },
      resolved: false,
      status: "open",
      synthetic: false,
      createdAt: Date.now(),
    });
    return null;
  },
});

const FOLLOW_UP_MS = 14 * 86_400_000;

// Called when a question's answer says the form changed (self or team link).
// The follow-up becomes due through a scheduled mutation, never a clock read in a query.
export async function startFollowUp(ctx: MutationCtx, questionId: Id<"questions">) {
  const q = await ctx.db.get("questions", questionId);
  if (!q || q.changedAt) return;
  await ctx.db.patch("questions", q._id, { changedAt: Date.now() });
  await ctx.scheduler.runAfter(FOLLOW_UP_MS, internal.questions.markFollowUpDue, { questionId: q._id });
}

export const markFollowUpDue = internalMutation({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    const q = await ctx.db.get("questions", args.questionId);
    if (q && !q.afterChangeOutcome) await ctx.db.patch("questions", q._id, { followUpDue: true });
    return null;
  },
});

// "What's the new form called?" (optional, short).
export const setNewForm = mutation({
  args: { anonId: v.string(), questionId: v.id("questions"), name: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const q = await ctx.db.get("questions", args.questionId);
    if (!q || q.profileId !== profile._id) throw new ConvexError("Question not found");
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new ConvexError("Type the new form's name as it's printed on the label.");
    await ctx.db.patch("questions", q._id, { newFormName: name });
    return null;
  },
});

// Follow-ups that are due: shown on the home screen until answered.
export const followUpsDue = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(100);
    return rows
      .filter((q) => q.followUpDue && !q.afterChangeOutcome)
      .map((q) => ({ _id: q._id, itemName: q.context.itemName ?? null, newFormName: q.newFormName ?? null, synthetic: q.synthetic }));
  },
});

// The two-week outcome: a normal log entry, linked to the question.
export const logAfterChange = mutation({
  args: { anonId: v.string(), questionId: v.id("questions"), outcome: outcomeValidator },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const q = await ctx.db.get("questions", args.questionId);
    if (!q || q.profileId !== profile._id) throw new ConvexError("Question not found");
    if (!q.followUpDue || q.afterChangeOutcome) throw new ConvexError("Nothing to follow up yet.");
    // The new form's own check, if they ran one, gives the catalog item.
    const check = await ctx.db
      .query("answers")
      .withIndex("by_profileId", (x) => x.eq("profileId", profile._id))
      .order("desc")
      .take(50);
    const followCheck = check.find((a) => a.followsQuestionId === q._id && a.itemId);
    const logId = await insertLog(ctx, profile, {
      outcome: args.outcome,
      itemId: followCheck?.itemId,
      itemText: followCheck ? undefined : (q.newFormName ?? q.context.itemName),
      // A follow-up on a seeded demo question stays demo data.
      synthetic: q.synthetic,
    });
    await ctx.db.patch("questions", q._id, { afterChangeOutcome: args.outcome, afterChangeLogId: logId, followUpDue: false });
    return logId;
  },
});

export function statusOf(q: Doc<"questions">): "open" | "asked" | "answered" {
  return q.status ?? (q.resolved ? "answered" : "open");
}

// "I asked this": open <-> asked. Answered questions move only by logging what they said.
export const setAsked = mutation({
  args: { anonId: v.string(), questionId: v.id("questions"), asked: v.boolean() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const q = await ctx.db.get("questions", args.questionId);
    if (!q || q.profileId !== profile._id) throw new ConvexError("Question not found");
    if (statusOf(q) === "answered") return null;
    await ctx.db.patch("questions", q._id, args.asked ? { status: "asked", askedAt: Date.now() } : { status: "open", askedAt: undefined });
    return null;
  },
});

export const listMine = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(50);
    return rows.map((q) => ({
      _id: q._id,
      text: q.text,
      itemName: q.context.itemName ?? null,
      answerId: q.context.answerId ?? null,
      resolved: q.resolved,
      status: statusOf(q),
      createdAt: q.createdAt,
    }));
  },
});

export const citationsFor = query({
  args: { anonId: v.string(), chunkIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireProfile(ctx, args.anonId);
    const out: { chunkId: string; sourceTitle: string; sourceUrl: string; text: string; section: string | null; verifiedAgainst: string | null }[] = [];
    for (const chunkId of args.chunkIds.slice(0, 30)) {
      const c = await ctx.db
        .query("guideline_chunks")
        .withIndex("by_chunkId", (q) => q.eq("chunkId", chunkId))
        .unique();
      if (c) {
        out.push({
          chunkId,
          sourceTitle: c.sourceTitle,
          sourceUrl: c.sourceUrl,
          text: c.text,
          section: c.section ?? null,
          verifiedAgainst: c.verified ? (c.verifiedAgainst ?? null) : null,
        });
      }
    }
    return out;
  },
});
