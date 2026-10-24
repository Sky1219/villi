import { ConvexError, v } from "convex/values";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { professionalTypeValidator, resultingChangeValidator } from "./schema";
import { requireProfile } from "./profiles";
import { retrier } from "./lib/retrier";
import { CARE_TEAM_MODERATION_SYSTEM, prefilter } from "./lib/moderation";
import { ANATOMY_KEYS, ANATOMY_LABELS, type AnatomyKey } from "./lib/anatomy";
import { claudeModerate } from "./moderation";
import type { Canonical } from "./canonicalize";
import { sheetFor } from "./sheet";
import { LINK_CHOICES } from "./lib/careFor";
import { statusOf } from "./questions";

// Inserts a care-team answer, marks the question answered and schedules the
// same moderation pass, whoever recorded it.
async function recordAnswer(
  ctx: MutationCtx,
  me: Doc<"profiles">,
  q: Doc<"questions">,
  a: {
    professionalType: Doc<"care_team_answers">["professionalType"];
    answerText: string;
    resultingChange: NonNullable<Doc<"care_team_answers">["resultingChange"]>;
    source: "self" | "team_link";
  },
) {
  const id = await ctx.db.insert("care_team_answers", {
    profileId: me._id,
    anatomySnapshot: me.anatomy,
    anatomyKey: me.anatomyKey,
    questionId: q._id,
    questionText: q.text,
    professionalType: a.professionalType,
    answerText: a.answerText,
    resultingChange: a.resultingChange,
    source: a.source,
    pooled: null,
    clinicianEndorsements: [],
    synthetic: false,
    createdAt: Date.now(),
  });
  await ctx.db.patch("questions", q._id, { resolved: true, status: "answered", askedAt: q.askedAt ?? Date.now() });
  const runId = await retrier.run(ctx, internal.careTeam.moderate, { id }, { onComplete: internal.careTeam.onModerated });
  await ctx.db.patch("care_team_answers", id, { moderationRunId: runId });
  return id;
}

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
    return await recordAnswer(ctx, me, q, { professionalType: args.professionalType, answerText, resultingChange: args.resultingChange, source: "self" });
  },
});

// ---- Care-team link: /team/<token>

const LINK_DAYS = 14;
const MAX_ACTIVE_LINKS = 3;

// 24 random bytes (192 bits) as base64url.
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const isActive = (l: Doc<"team_links">) => !l.revokedAt && !l.expiredAt;

export const createLink = mutation({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const links = await ctx.db
      .query("team_links")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .order("desc")
      .take(20);
    const now = Date.now();
    if (links.filter((l) => isActive(l) && l.expiresAt > now).length >= MAX_ACTIVE_LINKS) {
      throw new ConvexError("There are already 3 active links. Revoke one first.");
    }
    if (links.filter((l) => l.createdAt > now - 3_600_000).length >= 6) {
      throw new ConvexError("That's a lot of links in an hour. Try again later.");
    }
    const expiresAt = now + LINK_DAYS * 86_400_000;
    const token = newToken();
    const id = await ctx.db.insert("team_links", { profileId: me._id, token, createdAt: now, expiresAt });
    // Time-based state is written by a scheduled mutation, never read from the clock in a query.
    await ctx.scheduler.runAt(expiresAt, internal.careTeam.expireLink, { id });
    return { token, expiresAt };
  },
});

export const expireLink = internalMutation({
  args: { id: v.id("team_links") },
  handler: async (ctx, args) => {
    const l = await ctx.db.get("team_links", args.id);
    if (l && !l.expiredAt) await ctx.db.patch("team_links", l._id, { expiredAt: Date.now() });
    return null;
  },
});

export const revokeLink = mutation({
  args: { anonId: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const l = await ctx.db.query("team_links").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!l || l.profileId !== me._id) throw new ConvexError("Link not found");
    if (!l.revokedAt) await ctx.db.patch("team_links", l._id, { revokedAt: Date.now() });
    return null;
  },
});

export const myLinks = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const links = await ctx.db
      .query("team_links")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .order("desc")
      .take(20);
    return links.filter(isActive).map((l) => ({ token: l.token, createdAt: l.createdAt, expiresAt: l.expiresAt }));
  },
});

async function linkProfile(ctx: QueryCtx | MutationCtx, token: string) {
  if (token.length < 30) return null;
  const l = await ctx.db.query("team_links").withIndex("by_token", (q) => q.eq("token", token)).unique();
  if (!l || !isActive(l)) return null;
  const p = await ctx.db.get("profiles", l.profileId);
  return p ? { link: l, profile: p } : null;
}

// The read-only view behind /team/<token>: the sheet, in the third person.
// Never returns the anonId or any other profile's data.
export const linkView = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const found = await linkProfile(ctx, args.token);
    if (!found) return { expired: true as const };
    const sheet = await sheetFor(ctx, found.profile);
    return { expired: false as const, expiresAt: found.link.expiresAt, ...sheet };
  },
});

// The link holder records what happened to one question. Same answer row and
// outcome as the patient's own flow, marked source "team_link", moderated the
// same way before it can ever be shared.
export const linkRespond = mutation({
  args: {
    token: v.string(),
    questionId: v.id("questions"),
    professionalType: professionalTypeValidator,
    resultingChange: resultingChangeValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const found = await linkProfile(ctx, args.token);
    if (!found || found.link.expiresAt < Date.now()) throw new ConvexError("This link has expired");
    const { profile } = found;
    const q = await ctx.db.get("questions", args.questionId);
    if (!q || q.profileId !== profile._id) throw new ConvexError("Question not found");
    if (statusOf(q) === "answered") throw new ConvexError("This question already has an answer.");
    const recent = await ctx.db
      .query("care_team_answers")
      .withIndex("by_profileId", (x) => x.eq("profileId", profile._id))
      .order("desc")
      .take(10);
    if (recent.filter((r) => r.source === "team_link" && r.createdAt > Date.now() - 60_000).length >= 5) {
      throw new ConvexError("That's a lot of answers in a minute. Try again shortly.");
    }
    const note = args.note?.trim().slice(0, 280);
    await recordAnswer(ctx, profile, q, {
      professionalType: args.professionalType,
      answerText: note ? note : `${LINK_CHOICES[args.resultingChange]}.`,
      resultingChange: args.resultingChange,
      source: "team_link",
    });
    return null;
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
      itemId = c.itemId ?? undefined;
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
