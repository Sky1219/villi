import { ConvexError, v } from "convex/values";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { action, env, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireProfile } from "./profiles";
import { retrier } from "./lib/retrier";
import { anthropicClient, fastModel } from "./lib/llm";
import { SWAP_MODERATION_SYSTEM, SwapModerationSchema, prefilter, type SwapModerationDecision } from "./lib/moderation";
import { checkSwap } from "./lib/swapCheck";
import { scanWarningSigns } from "./lib/warningSigns";
import { ANATOMY_KEYS, ANATOMY_LABELS, scopeTagsFor, type Anatomy, type AnatomyKey } from "./lib/anatomy";
import type { Canonical } from "./canonicalize";
import type { ChunkView } from "./guidelines";

// ---- submit: canonicalize both sides, insert hidden, schedule the safety pass

export const profileFor = internalQuery({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const p = await requireProfile(ctx, args.anonId);
    return { _id: p._id, anatomy: p.anatomy, anatomyKey: p.anatomyKey };
  },
});

export const insertSwap = internalMutation({
  args: {
    profileId: v.id("profiles"),
    insteadOfItemId: v.id("items"),
    useItemId: v.id("items"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get("profiles", args.profileId);
    if (!p) throw new ConvexError("No profile");
    const recent = await ctx.db
      .query("swaps")
      .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
      .order("desc")
      .take(10);
    if (recent.filter((r) => r.createdAt > Date.now() - 60_000).length >= 3) {
      throw new ConvexError("That's a lot of swaps in a minute. Try again shortly.");
    }
    const swapId = await ctx.db.insert("swaps", {
      profileId: p._id,
      anatomySnapshot: p.anatomy,
      anatomyKey: p.anatomyKey,
      insteadOfItemId: args.insteadOfItemId,
      useItemId: args.useItemId,
      note: args.note,
      pooled: null,
      upvotes: 0,
      clinicianEndorsements: [],
      synthetic: false,
      createdAt: Date.now(),
    });
    const runId = await retrier.run(ctx, internal.swaps.moderate, { swapId }, { onComplete: internal.swaps.onModerated });
    await ctx.db.patch("swaps", swapId, { moderationRunId: runId });
    return swapId;
  },
});

// Public action because both items need canonicalizing first; the row itself is
// written only by the internal mutation, with pooled: null.
export const submit = action({
  args: { anonId: v.string(), insteadOf: v.string(), use: v.string(), note: v.string() },
  handler: async (ctx, args): Promise<Id<"swaps">> => {
    const profile: { _id: Id<"profiles"> } = await ctx.runQuery(internal.swaps.profileFor, { anonId: args.anonId });
    const insteadOf = args.insteadOf.trim().slice(0, 80);
    const use = args.use.trim().slice(0, 80);
    if (!insteadOf || !use) throw new ConvexError("Fill in both sides of the swap.");
    const [a, b]: Canonical[] = await Promise.all([
      ctx.runAction(internal.canonicalize.run, { text: insteadOf }),
      ctx.runAction(internal.canonicalize.run, { text: use }),
    ]);
    for (const [c, typed] of [[a, insteadOf], [b, use]] as const) {
      if (!c.itemId) throw new ConvexError(`Villi couldn't find "${typed}" in the FDA label list. Check the spelling on the label.`);
    }
    if (a.itemId === b.itemId) throw new ConvexError("Those look like the same thing.");
    return await ctx.runMutation(internal.swaps.insertSwap, {
      profileId: profile._id,
      insteadOfItemId: a.itemId!,
      useItemId: b.itemId!,
      note: args.note.trim().slice(0, 280),
    });
  },
});

// ---- moderation: deterministic guideline check, rule pre-filter, then Claude

export const getForModeration = internalQuery({
  args: { swapId: v.id("swaps") },
  handler: async (ctx, args) => {
    const s = await ctx.db.get("swaps", args.swapId);
    if (!s) return null;
    const [a, b] = await Promise.all([ctx.db.get("items", s.insteadOfItemId), ctx.db.get("items", s.useItemId)]);
    if (!a || !b) return null;
    return { swap: s, insteadOf: a, use: b };
  },
});

export const applyModeration = internalMutation({
  args: {
    swapId: v.id("swaps"),
    pooled: v.boolean(),
    reason: v.union(v.string(), v.null()),
    nudge: v.union(v.string(), v.null()),
    guidelineCheck: v.object({ passed: v.boolean(), citations: v.array(v.string()) }),
  },
  handler: async (ctx, args) => {
    const s = await ctx.db.get("swaps", args.swapId);
    if (!s || s.pooled !== null) return null; // idempotent under retries
    await ctx.db.patch("swaps", s._id, {
      pooled: args.pooled,
      moderationReason: args.reason ?? undefined,
      nudgeUser: args.pooled ? undefined : (args.nudge ?? undefined),
      guidelineCheck: args.guidelineCheck,
    });
    return null;
  },
});

async function claudeSwap(text: string, anatomy: Anatomy, chunks: ChunkView[]): Promise<SwapModerationDecision> {
  const client = anthropicClient(env);
  const res = await client.messages.parse({
    model: fastModel(env),
    max_tokens: 1500,
    system: SWAP_MODERATION_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(SwapModerationSchema) },
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          authorAnatomy: anatomy,
          swap: `<entry>${text.slice(0, 600)}</entry>`,
          guidelineChunks: chunks.map((c) => ({ chunkId: c.chunkId, text: c.text })),
        }),
      },
    ],
  });
  if (res.stop_reason === "refusal") return { pooled: false, reason: "moderator declined", nudgeUser: null, guidelineConflict: false, citations: [] };
  if (!res.parsed_output) throw new Error("swap moderation returned nothing");
  return res.parsed_output;
}

export const moderate = internalAction({
  args: { swapId: v.id("swaps") },
  handler: async (ctx, args): Promise<null> => {
    const data: { swap: Doc<"swaps">; insteadOf: Doc<"items">; use: Doc<"items"> } | null = await ctx.runQuery(
      internal.swaps.getForModeration,
      args,
    );
    if (!data || data.swap.pooled !== null) return null;
    const { swap, insteadOf, use } = data;
    const check = checkSwap(insteadOf, use, swap.anatomySnapshot);
    const text = `Instead of ${insteadOf.canonicalName}, I have ${use.canonicalName}. ${swap.note}`;

    // 1. Guidelines win: a deterministic conflict is never pooled.
    if (!check.passed) {
      const c = check.conflicts[0];
      await ctx.runMutation(internal.swaps.applyModeration, {
        swapId: swap._id,
        pooled: false,
        reason: `guideline conflict: ${c.reason}`,
        nudge: `Thanks for sharing. This one stays with you: ${c.reason} for your anatomy [${c.citation}].`,
        guidelineCheck: { passed: false, citations: check.citations },
      });
      return null;
    }
    // 2. Rules on the free text. A note describing warning signs is never shown to others.
    const pre =
      prefilter(text) ??
      (scanWarningSigns(swap.note).level
        ? {
            pooled: false,
            reason: "describes possible warning signs",
            nudgeUser: "Thanks for sharing. This one stays with you because it mentions how someone is feeling; if it's happening now, please contact the care team.",
          }
        : null);
    if (pre) {
      await ctx.runMutation(internal.swaps.applyModeration, {
        swapId: swap._id,
        pooled: false,
        reason: pre.reason,
        nudge: pre.nudgeUser,
        guidelineCheck: { passed: true, citations: check.citations },
      });
      return null;
    }
    // 3. Claude, given the guideline chunks in this author's scope.
    const search: { chunks: ChunkView[] } = await ctx.runAction(internal.guidelines.search, {
      query: `${use.canonicalName} ${insteadOf.canonicalName} ${use.category}`,
      scopeTags: scopeTagsFor(swap.anatomySnapshot),
      limit: 6,
    });
    const supportIds = check.citations.map((c) => c.replace(/^G:/, ""));
    const support: ChunkView[] = supportIds.length ? await ctx.runQuery(internal.guidelines.byChunkIds, { chunkIds: supportIds }) : [];
    const chunks = [...support, ...search.chunks.filter((c) => !supportIds.includes(c.chunkId))];
    const d = await claudeSwap(text, swap.anatomySnapshot, chunks);
    const known = new Set(chunks.map((c) => c.chunkId));
    const modelCites = d.citations.map((c) => c.replace(/^\[?G:|\]$/g, "")).filter((c) => known.has(c)).map((c) => `G:${c}`);
    const pooled = d.pooled && !d.guidelineConflict;
    await ctx.runMutation(internal.swaps.applyModeration, {
      swapId: swap._id,
      pooled,
      reason: d.reason,
      nudge: d.nudgeUser,
      guidelineCheck: {
        passed: !d.guidelineConflict,
        citations: Array.from(new Set([...check.citations, ...modelCites])),
      },
    });
    return null;
  },
});

// Retries exhausted: fail closed, author-only.
export const onModerated = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  handler: async (ctx, args) => {
    if (args.result.type === "success") return null;
    const s = await ctx.db
      .query("swaps")
      .withIndex("by_moderationRunId", (q) => q.eq("moderationRunId", args.runId))
      .unique();
    if (!s || s.pooled !== null) return null;
    await ctx.db.patch("swaps", s._id, { pooled: false, moderationReason: "moderation unavailable" });
    return null;
  },
});

// ---- board

export const list = query({
  args: { anonId: v.string(), anatomy: v.union(v.literal("mine"), v.literal("all"), v.string()) },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const keys =
      args.anatomy === "all" ? [...ANATOMY_KEYS] : args.anatomy === "mine" ? [me.anatomyKey] : [args.anatomy];
    const rows: Doc<"swaps">[] = [];
    for (const key of keys) {
      rows.push(
        ...(await ctx.db
          .query("swaps")
          .withIndex("by_pooled_and_anatomyKey", (q) => q.eq("pooled", true).eq("anatomyKey", key))
          .order("desc")
          .take(60)),
      );
    }
    const mine = await ctx.db
      .query("swaps")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .order("desc")
      .take(10);
    const names = new Map<Id<"items">, string>();
    const nameOf = async (id: Id<"items">) => {
      if (!names.has(id)) names.set(id, (await ctx.db.get("items", id))?.canonicalName ?? "item");
      return names.get(id)!;
    };
    const view = async (s: Doc<"swaps">) => {
      const vote = await ctx.db
        .query("swap_votes")
        .withIndex("by_swapId_and_profileId", (q) => q.eq("swapId", s._id).eq("profileId", me._id))
        .unique();
      return {
        _id: s._id,
        insteadOf: await nameOf(s.insteadOfItemId),
        use: await nameOf(s.useItemId),
        note: s.note,
        anatomyKey: s.anatomyKey,
        anatomyLabel: ANATOMY_LABELS[s.anatomyKey as AnatomyKey] ?? s.anatomyKey,
        upvotes: s.upvotes,
        youVoted: !!vote,
        endorsements: s.clinicianEndorsements.length,
        youEndorsed: s.clinicianEndorsements.includes(me._id),
        citations: s.guidelineCheck?.citations ?? [],
        status: s.pooled === null ? "checking" : s.pooled ? "shared" : "private",
        nudge: s.nudgeUser ?? null,
        mine: s.profileId === me._id,
        synthetic: s.synthetic,
        createdAt: s.createdAt,
      };
    };
    const board = await Promise.all(
      rows.sort((a, b) => b.upvotes - a.upvotes || b.createdAt - a.createdAt).slice(0, 60).map(view),
    );
    return {
      canEndorse: me.role === "clinician" && me.clinicianDemoVerified,
      board,
      mine: await Promise.all(mine.map(view)),
    };
  },
});

export const upvote = mutation({
  args: { anonId: v.string(), swapId: v.id("swaps") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const s = await ctx.db.get("swaps", args.swapId);
    if (!s || s.pooled !== true) throw new ConvexError("Swap not found");
    const vote = await ctx.db
      .query("swap_votes")
      .withIndex("by_swapId_and_profileId", (q) => q.eq("swapId", s._id).eq("profileId", me._id))
      .unique();
    if (vote) {
      await ctx.db.delete("swap_votes", vote._id);
      await ctx.db.patch("swaps", s._id, { upvotes: Math.max(0, s.upvotes - 1) });
    } else {
      await ctx.db.insert("swap_votes", { swapId: s._id, profileId: me._id });
      await ctx.db.patch("swaps", s._id, { upvotes: s.upvotes + 1 });
    }
    return null;
  },
});

// Honor-system in this build; shown as "demo verification".
export const endorse = mutation({
  args: { anonId: v.string(), swapId: v.id("swaps") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    if (me.role !== "clinician" || !me.clinicianDemoVerified) throw new ConvexError("Only clinician profiles can endorse.");
    const s = await ctx.db.get("swaps", args.swapId);
    if (!s || s.pooled !== true) throw new ConvexError("Swap not found");
    const has = s.clinicianEndorsements.includes(me._id);
    await ctx.db.patch("swaps", s._id, {
      clinicianEndorsements: has ? s.clinicianEndorsements.filter((x) => x !== me._id) : [...s.clinicianEndorsements, me._id],
    });
    return null;
  },
});
