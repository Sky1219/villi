import { ConvexError, v } from "convex/values";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { professionalTypeValidator, resultingChangeValidator } from "./schema";
import { requireProfile } from "./profiles";
import { retrier } from "./lib/retrier";
import { CARE_TEAM_MODERATION_SYSTEM, prefilter } from "./lib/moderation";
import { ANATOMY_KEYS, ANATOMY_LABELS, type AnatomyKey } from "./lib/anatomy";
import { claudeModerate } from "./moderation";
import type { Canonical } from "./canonicalize";

// "Log the answer" from the appointment sheet. Hidden until moderated.
export const logAnswer = mutation({
  args: {
    anonId: v.string(),
    questionId: v.id("questions"),
    professionalType: professionalTypeValidator,
    answerText: v.string(),
    resultingChange: resultingChangeValidator,
  },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const q = await ctx.db.get("questions", args.questionId);
    if (!q || q.profileId !== me._id) throw new ConvexError("Question not found");
    const answerText = args.answerText.trim().slice(0, 500);
    if (!answerText) throw new ConvexError("What did they say?");
    const id = await ctx.db.insert("care_team_answers", {
      profileId: me._id,
      anatomySnapshot: me.anatomy,
      anatomyKey: me.anatomyKey,
      questionId: q._id,
      questionText: q.text,
      professionalType: args.professionalType,
      answerText,
      resultingChange: args.resultingChange,
      pooled: null,
      clinicianEndorsements: [],
      synthetic: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch("questions", q._id, { resolved: true, status: "answered", askedAt: q.askedAt ?? Date.now() });
    const runId = await retrier.run(ctx, internal.careTeam.moderate, { id }, { onComplete: internal.careTeam.onModerated });
    await ctx.db.patch("care_team_answers", id, { moderationRunId: runId });
    return id;
  },
});

// "Not decided yet" is updated by the author when the team decides.
export const setResultingChange = mutation({
  args: { anonId: v.string(), id: v.id("care_team_answers"), resultingChange: resultingChangeValidator },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const row = await ctx.db.get("care_team_answers", args.id);
    if (!row || row.profileId !== me._id) throw new ConvexError("Answer not found");
    await ctx.db.patch("care_team_answers", row._id, { resultingChange: args.resultingChange });
    return null;
  },
});

export const getForModeration = internalQuery({
  args: { id: v.id("care_team_answers") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("care_team_answers", args.id);
    if (!row) return null;
    const q = row.questionId ? await ctx.db.get("questions", row.questionId) : null;
    return { row, itemName: q?.context.itemName ?? null };
  },
});

export const apply = internalMutation({
  args: {
    id: v.id("care_team_answers"),
    itemId: v.optional(v.id("items")),
    pooled: v.boolean(),
    reason: v.union(v.string(), v.null()),
    nudge: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("care_team_answers", args.id);
    if (!row || row.pooled !== null) return null;
    await ctx.db.patch("care_team_answers", row._id, {
      itemId: args.itemId,
      pooled: args.pooled,
      moderationReason: args.reason ?? undefined,
      nudgeUser: args.pooled ? undefined : (args.nudge ?? undefined),
    });
    return null;
  },
});

export const moderate = internalAction({
  args: { id: v.id("care_team_answers") },
  handler: async (ctx, args): Promise<null> => {
    const data: { row: Doc<"care_team_answers">; itemName: string | null } | null = await ctx.runQuery(
      internal.careTeam.getForModeration,
      args,
    );
    if (!data || data.row.pooled !== null) return null;
    let itemId: Id<"items"> | undefined;
    if (data.itemName) {
      const c: Canonical = await ctx.runAction(internal.canonicalize.run, { text: data.itemName });
      itemId = c.itemId;
    }
    // Rules screen only what the user wrote; the question is our own reviewed
    // ASK line (it may carry the product's printed strength) and is context for Claude.
    const text = `Question: ${data.row.questionText}\nWhat my ${data.row.professionalType} said: ${data.row.answerText}`;
    const pre = prefilter(data.row.answerText);
    const d = pre ?? (await claudeModerate(text, CARE_TEAM_MODERATION_SYSTEM));
    await ctx.runMutation(internal.careTeam.apply, { id: args.id, itemId, pooled: d.pooled, reason: d.reason, nudge: d.nudgeUser });
    return null;
  },
});

export const onModerated = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  handler: async (ctx, args) => {
    if (args.result.type === "success") return null;
    const row = await ctx.db
      .query("care_team_answers")
      .withIndex("by_moderationRunId", (q) => q.eq("moderationRunId", args.runId))
      .unique();
    if (!row || row.pooled !== null) return null;
    await ctx.db.patch("care_team_answers", row._id, { pooled: false, moderationReason: "moderation unavailable" });
    return null;
  },
});

export const list = query({
  args: { anonId: v.string(), anatomy: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const keys = args.anatomy === "all" ? [...ANATOMY_KEYS] : args.anatomy === "mine" ? [me.anatomyKey] : [args.anatomy];
    const rows: Doc<"care_team_answers">[] = [];
    for (const key of keys) {
      rows.push(
        ...(await ctx.db
          .query("care_team_answers")
          .withIndex("by_pooled_and_anatomyKey", (q) => q.eq("pooled", true).eq("anatomyKey", key))
          .order("desc")
          .take(40)),
      );
    }
    const out = [];
    for (const r of rows.sort((a, b) => b.clinicianEndorsements.length - a.clinicianEndorsements.length || b.createdAt - a.createdAt).slice(0, 40)) {
      const item = r.itemId ? await ctx.db.get("items", r.itemId) : null;
      out.push({
        _id: r._id,
        item: item?.canonicalName ?? null,
        question: r.questionText,
        answer: r.answerText,
        professionalType: r.professionalType,
        anatomyKey: r.anatomyKey,
        anatomyLabel: ANATOMY_LABELS[r.anatomyKey as AnatomyKey] ?? r.anatomyKey,
        endorsements: r.clinicianEndorsements.length,
        youEndorsed: r.clinicianEndorsements.includes(me._id),
        mine: r.profileId === me._id,
        synthetic: r.synthetic,
      });
    }
    return { canEndorse: me.role === "clinician" && me.clinicianDemoVerified, answers: out };
  },
});

export const endorse = mutation({
  args: { anonId: v.string(), id: v.id("care_team_answers") },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    if (me.role !== "clinician" || !me.clinicianDemoVerified) throw new ConvexError("Only clinician profiles can endorse.");
    const r = await ctx.db.get("care_team_answers", args.id);
    if (!r || r.pooled !== true) throw new ConvexError("Not found");
    const has = r.clinicianEndorsements.includes(me._id);
    await ctx.db.patch("care_team_answers", r._id, {
      clinicianEndorsements: has ? r.clinicianEndorsements.filter((x) => x !== me._id) : [...r.clinicianEndorsements, me._id],
    });
    return null;
  },
});

// The author's own logged answers, with moderation status, keyed by question.
export const mineByQuestion = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const rows = await ctx.db
      .query("care_team_answers")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .order("desc")
      .take(50);
    return rows.map((r) => ({
      _id: r._id,
      questionId: r.questionId ?? null,
      professionalType: r.professionalType,
      answer: r.answerText,
      resultingChange: r.resultingChange ?? null,
      status: r.pooled === null ? "checking" : r.pooled ? "shared" : "private",
      nudge: r.nudgeUser ?? null,
    }));
  },
});

// `npx convex run careTeam:evalFixtures`: the care-team moderator alone on known cases.
const CARE_TEAM_FIXTURES: { text: string; pooled: boolean }[] = [
  {
    text: "Question: Is a sports drink as good as ORS?\nWhat my dietitian said: Sports drinks are too low in salt for a jejunostomy; she walked us through an ORS recipe the team uses and asked us to check with her before changing fluids.",
    pooled: true,
  },
  {
    text: "Question: Is my ER tablet absorbed?\nWhat my pharmacist said: The extended-release design may not release fully with a short gut, so she asked the cardiologist to review the form.",
    pooled: true,
  },
  {
    text: "Question: Which ORS?\nWhat my dietitian said: Mix 3.5 g salt and 20 g glucose in a litre and drink two litres a day.",
    pooled: false,
  },
  {
    text: "Question: My PPI?\nWhat my doctor said: Everyone with an ileostomy should just stop their PPI, it does nothing.",
    pooled: false,
  },
];

export const evalFixtures = internalAction({
  args: {},
  handler: async () => {
    const rows = await Promise.all(
      CARE_TEAM_FIXTURES.map(async (f) => {
        const pre = prefilter(f.text.split("said: ")[1] ?? f.text);
        const d = pre ?? (await claudeModerate(f.text, CARE_TEAM_MODERATION_SYSTEM));
        return { expected: f.pooled, got: d.pooled, by: pre ? "rule" : "model", reason: d.reason };
      }),
    );
    return { correct: rows.filter((r) => r.expected === r.got).length, total: rows.length, rows };
  },
});
