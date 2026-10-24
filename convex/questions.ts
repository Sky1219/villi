import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProfile } from "./profiles";
import { extractCitations } from "./lib/safety";
import type { Doc } from "./_generated/dataModel";

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
