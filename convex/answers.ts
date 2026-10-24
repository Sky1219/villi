import { ConvexError, v } from "convex/values";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { retrier } from "./lib/retrier";
import type { Doc } from "./_generated/dataModel";
import { categoryValidator } from "./schema";
import { requireProfile } from "./profiles";

const MAX_TRACE = 40;
const STUCK_MS = 5 * 60_000;

// What the client may see. Drafts live in answer_reviews and never leave the server.
function publicAnswer(a: Doc<"answers">) {
  const done = a.status === "final";
  return {
    _id: a._id,
    kind: a.kind,
    parentId: a.parentId ?? null,
    status: a.status,
    inputText: a.input.text ?? null,
    hadPhoto: !!a.input.photoId,
    identified: a.identified ?? null,
    itemId: a.itemId ?? null,
    toolTrace: a.toolTrace,
    final: done ? a.final : null,
    reviewSummary: a.reviewSummary ?? null,
    error: a.status === "failed" || a.status === "blocked" ? (a.error ?? null) : null,
    createdAt: a.createdAt,
  };
}
export type PublicAnswer = ReturnType<typeof publicAnswer>;

export const generateUploadUrl = mutation({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    await requireProfile(ctx, args.anonId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const start = mutation({
  args: {
    anonId: v.string(),
    text: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    category: v.optional(categoryValidator),
    parentId: v.optional(v.id("answers")),
  },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const text = args.text?.trim().slice(0, 500);
    if (!text && !args.photoId) throw new ConvexError("Type a name or add a photo.");

    // Per-device rate limit: the URL is public and every scan costs model time.
    const recent = await ctx.db
      .query("answers")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(6);
    if (recent.filter((r) => r.createdAt > Date.now() - 60_000).length >= 5) {
      throw new ConvexError("That's a lot of checks in a minute. Wait a moment and try again.");
    }
    if (args.parentId) {
      const parent = await ctx.db.get("answers", args.parentId);
      if (!parent || parent.profileId !== profile._id) throw new ConvexError("Answer not found");
    }

    const answerId = await ctx.db.insert("answers", {
      profileId: profile._id,
      kind: args.parentId ? "followup" : "scan",
      parentId: args.parentId,
      input: { text, photoId: args.photoId, category: args.category },
      status: "queued",
      toolTrace: [],
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.agent.run, { answerId });
    await ctx.scheduler.runAfter(STUCK_MS, internal.answers.watchdog, { answerId });
    return answerId;
  },
});

export const get = query({
  args: { anonId: v.string(), answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.profileId !== profile._id) return null;
    return publicAnswer(a);
  },
});

export const listMine = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const rows = await ctx.db
      .query("answers")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .order("desc")
      .take(10);
    return rows
      .filter((r) => r.kind === "scan")
      .map((r) => ({
        _id: r._id,
        status: r.status,
        title: r.identified ?? r.input.text ?? "Photo",
        verdict: r.status === "final" ? ((r.final as { verdict?: string } | undefined)?.verdict ?? null) : null,
        createdAt: r.createdAt,
      }));
  },
});

// ---- internal state machine: queued -> running -> reviewing -> final | blocked | failed

export const getForAgent = internalQuery({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a) return null;
    let parent: { final: unknown; identified: string | null; inputText: string | null } | null = null;
    if (a.parentId) {
      const p = await ctx.db.get("answers", a.parentId);
      if (p) parent = { final: p.final ?? null, identified: p.identified ?? null, inputText: p.input.text ?? null };
    }
    return { answer: a, parent };
  },
});

export const markRunning = internalMutation({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.status !== "queued") return false;
    await ctx.db.patch("answers", a._id, { status: "running" });
    return true;
  },
});

export const setIdentified = internalMutation({
  args: { answerId: v.id("answers"), identified: v.string(), clearPhoto: v.boolean() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a) return null;
    // Bottle labels carry names and dates: delete the photo once it has been read.
    if (args.clearPhoto && a.input.photoId) {
      await ctx.storage.delete(a.input.photoId);
      await ctx.db.patch("answers", a._id, {
        identified: args.identified.slice(0, 200),
        input: { ...a.input, photoId: undefined },
      });
      return null;
    }
    await ctx.db.patch("answers", a._id, { identified: args.identified.slice(0, 200) });
    return null;
  },
});

export const setItem = internalMutation({
  args: { answerId: v.id("answers"), itemId: v.id("items") },
  handler: async (ctx, args) => {
    await ctx.db.patch("answers", args.answerId, { itemId: args.itemId });
    return null;
  },
});

export const appendTrace = internalMutation({
  args: { answerId: v.id("answers"), tool: v.string(), summary: v.string(), ok: v.boolean() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.toolTrace.length >= MAX_TRACE) return null;
    await ctx.db.patch("answers", a._id, {
      toolTrace: [
        ...a.toolTrace,
        { step: a.toolTrace.length + 1, tool: args.tool, summary: args.summary.slice(0, 300), ok: args.ok, at: Date.now() },
      ],
    });
    return null;
  },
});

// The draft and the reviewer schedule commit in one transaction, so a draft can
// never exist without a pending review.
export const saveDraft = internalMutation({
  args: { answerId: v.id("answers"), draft: v.any(), registry: v.any() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.status !== "running") return null;
    const reviewId = await ctx.db.insert("answer_reviews", {
      answerId: a._id,
      draft: args.draft,
      registry: args.registry,
      lint: [],
      attempts: 0,
      createdAt: Date.now(),
    });
    await ctx.db.patch("answers", a._id, { status: "reviewing" });
    const runId = await retrier.run(ctx, internal.reviewer.run, { answerId: a._id }, {
      onComplete: internal.answers.onReviewComplete,
    });
    await ctx.db.patch("answer_reviews", reviewId, { runId });
    return null;
  },
});

export const getReview = internalQuery({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const r = await ctx.db
      .query("answer_reviews")
      .withIndex("by_answerId", (q) => q.eq("answerId", args.answerId))
      .order("desc")
      .first();
    const a = await ctx.db.get("answers", args.answerId);
    if (!r || !a) return null;
    const profile = await ctx.db.get("profiles", a.profileId);
    return { draft: r.draft, registry: r.registry, status: a.status, language: profile?.language ?? "en" };
  },
});

// Only path that writes answers.final. Idempotent: ignores anything not under review.
export const finalize = internalMutation({
  args: {
    answerId: v.id("answers"),
    status: v.union(v.literal("final"), v.literal("blocked")),
    final: v.optional(v.any()),
    edited: v.boolean(),
    blockedReasons: v.array(v.string()),
    lint: v.array(v.string()),
    decision: v.union(
      v.object({ approved: v.boolean(), edits: v.union(v.string(), v.null()), blockedReasons: v.array(v.string()) }),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.status !== "reviewing") return null;
    const review = await ctx.db
      .query("answer_reviews")
      .withIndex("by_answerId", (q) => q.eq("answerId", a._id))
      .order("desc")
      .first();
    if (review) {
      await ctx.db.patch("answer_reviews", review._id, {
        lint: args.lint,
        reviewerDecision: args.decision ?? undefined,
        attempts: review.attempts + 1,
      });
    }
    const secs = review ? ((Date.now() - review.createdAt) / 1000).toFixed(0) : "?";
    await ctx.db.patch("answers", a._id, {
      toolTrace: [
        ...a.toolTrace,
        {
          step: a.toolTrace.length + 1,
          tool: "reviewer",
          summary:
            args.status === "final"
              ? `${args.edited ? "edited and approved" : "approved"} in ${secs}s${args.lint.length ? `; code checks removed ${args.lint.length} item(s)` : ""}`
              : `blocked: ${args.blockedReasons.join("; ")}`.slice(0, 300),
          ok: args.status === "final",
          at: Date.now(),
        },
      ],
      status: args.status,
      final: args.status === "final" ? args.final : undefined,
      reviewSummary: {
        approved: args.status === "final",
        edited: args.edited,
        blockedReasons: args.blockedReasons,
      },
      error:
        args.status === "blocked"
          ? "The safety check stopped this answer, so we won't show it. Please ask your pharmacist directly, or try asking a different way."
          : undefined,
    });
    return null;
  },
});

// Retries exhausted: fail closed. An unreviewed draft never becomes final.
export const onReviewComplete = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  handler: async (ctx, args) => {
    if (args.result.type === "success") return null;
    const review = await ctx.db
      .query("answer_reviews")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (!review) return null;
    const a = await ctx.db.get("answers", review.answerId);
    if (!a || a.status !== "reviewing") return null;
    await ctx.db.patch("answers", a._id, {
      status: "blocked",
      reviewSummary: { approved: false, edited: false, blockedReasons: ["reviewer unavailable"] },
      error: "The safety check couldn't run, so we won't show an unchecked answer. Try again in a minute.",
    });
    return null;
  },
});

export const fail = internalMutation({
  args: { answerId: v.id("answers"), error: v.string() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.status === "final" || a.status === "blocked") return null;
    await ctx.db.patch("answers", a._id, { status: "failed", error: args.error.slice(0, 300) });
    return null;
  },
});

export const watchdog = internalMutation({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const a = await ctx.db.get("answers", args.answerId);
    if (!a || a.status === "final" || a.status === "blocked" || a.status === "failed") return null;
    await ctx.db.patch("answers", a._id, {
      status: "failed",
      error: "This took too long and was stopped. Please try again.",
    });
    return null;
  },
});
