import { ConvexError, v } from "convex/values";
import {
  env,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { anatomyValidator, caresForValidator, roleValidator } from "./schema";
import { internal } from "./_generated/api";
import { applyPooledTransition } from "./community";
import { SEGMENTS, anatomyKeyOf, defaultDiagram, describeAnatomy, type DiagramState, type SegmentId } from "./lib/anatomy";
import type { Doc } from "./_generated/dataModel";

// The anonId (random UUID in localStorage) is the capability secret. It is
// never returned by any query, and every public function resolves it here.
export async function requireProfile(
  ctx: QueryCtx | MutationCtx,
  anonId: string,
): Promise<Doc<"profiles">> {
  const profile = await findProfile(ctx, anonId);
  if (!profile) throw new ConvexError("No profile for this device. Set one up first.");
  return profile;
}

async function findProfile(ctx: QueryCtx | MutationCtx, anonId: string) {
  if (anonId.length < 20) return null;
  return await ctx.db
    .query("profiles")
    .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
    .unique();
}

export function diagramOf(p: Doc<"profiles">): DiagramState {
  if (!p.diagram) return defaultDiagram(p.anatomy);
  const valid = (s: string): s is SegmentId => (SEGMENTS as readonly string[]).includes(s);
  return {
    removed: p.diagram.removed.filter(valid),
    stomaAfter: p.diagram.stomaAfter && valid(p.diagram.stomaAfter) ? p.diagram.stomaAfter : null,
  };
}

function publicProfile(p: Doc<"profiles">) {
  return {
    diagram: diagramOf(p),
    _id: p._id,
    role: p.role,
    anatomy: p.anatomy,
    anatomyKey: p.anatomyKey,
    anatomyText: describeAnatomy(p.anatomy),
    language: p.language,
    caresFor: p.role === "caregiver" ? (p.caresFor ?? null) : null,
    clinicianDemoVerified: p.clinicianDemoVerified,
    templateKey: p.templateKey ?? null,
  };
}

export const me = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const p = await findProfile(ctx, args.anonId);
    if (!p) return null;
    const meds = await ctx.db
      .query("meds")
      .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
      .take(50);
    return {
      ...publicProfile(p),
      meds: meds.map((m) => ({ _id: m._id, name: m.name, dosageForm: m.dosageForm ?? null })),
    };
  },
});

export const upsert = mutation({
  args: {
    anonId: v.string(),
    role: roleValidator,
    anatomy: anatomyValidator,
    language: v.string(),
    caresFor: v.optional(caresForValidator),
    diagram: v.optional(v.object({ removed: v.array(v.string()), stomaAfter: v.union(v.string(), v.null()) })),
  },
  handler: async (ctx, args) => {
    if (args.anonId.length < 20) throw new ConvexError("bad device id");
    const existing = await findProfile(ctx, args.anonId);
    const valid = (s: string) => (SEGMENTS as readonly string[]).includes(s);
    if (args.diagram && (!args.diagram.removed.every(valid) || (args.diagram.stomaAfter && !valid(args.diagram.stomaAfter)))) {
      throw new ConvexError("unknown segment");
    }
    const fields = {
      // Dropdown edits clear an old drawing so the two never disagree.
      diagram: args.diagram,
      role: args.role,
      anatomy: args.anatomy,
      anatomyKey: anatomyKeyOf(args.anatomy),
      language: args.language.slice(0, 16),
      caresFor: args.role === "caregiver" ? (args.caresFor ?? "other") : undefined,
      // Honor-system in the hackathon build, badged "demo verification".
      clinicianDemoVerified: args.role === "clinician",
    };
    if (existing) {
      await ctx.db.patch("profiles", existing._id, fields);
      return null;
    }
    await ctx.db.insert("profiles", {
      anonId: args.anonId,
      ...fields,
      synthetic: false,
      createdAt: Date.now(),
    });
    return null;
  },
});

// /demo?as=father|peer clones a template profile (and its meds) onto this device.
export const cloneDemo = mutation({
  args: { anonId: v.string(), as: v.union(v.literal("father"), v.literal("peer")) },
  handler: async (ctx, args) => {
    if (env.DEMO_MODE === "off") throw new ConvexError("Demo profiles are turned off.");
    if (args.anonId.length < 20) throw new ConvexError("bad device id");
    const template = await ctx.db
      .query("profiles")
      .withIndex("by_templateKey", (q) => q.eq("templateKey", args.as))
      .first();
    if (!template) throw new ConvexError("Demo data is not seeded yet. Run `npm run seed`.");

    const existing = await findProfile(ctx, args.anonId);
    if (existing) {
      const oldMeds = await ctx.db
        .query("meds")
        .withIndex("by_profileId", (q) => q.eq("profileId", existing._id))
        .take(50);
      for (const m of oldMeds) await ctx.db.delete("meds", m._id);
      await ctx.db.patch("profiles", existing._id, {
        role: template.role,
        anatomy: template.anatomy,
        anatomyKey: template.anatomyKey,
        language: template.language,
        caresFor: template.caresFor,
        diagram: template.diagram,
        clinicianDemoVerified: false,
      });
    }
    const profileId =
      existing?._id ??
      (await ctx.db.insert("profiles", {
        anonId: args.anonId,
        role: template.role,
        anatomy: template.anatomy,
        anatomyKey: template.anatomyKey,
        language: template.language,
        caresFor: template.caresFor,
        diagram: template.diagram,
        clinicianDemoVerified: false,
        synthetic: false,
        createdAt: Date.now(),
      }));
    const meds = await ctx.db
      .query("meds")
      .withIndex("by_profileId", (q) => q.eq("profileId", template._id))
      .take(50);
    for (const { _id, _creationTime, profileId: _p, ...rest } of meds) {
      const medId = await ctx.db.insert("meds", { ...rest, profileId, addedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.meds.enrich, { medId });
    }
    return null;
  },
});

// "Delete my data": everything tied to this device's profile, including its
// contribution to community counts. Bounded batches; the client calls again until done.
export const deleteMine = mutation({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const p = await findProfile(ctx, args.anonId);
    if (!p) return { done: true };
    const BATCH = 200;
    const logs = await ctx.db.query("log_entries").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const l of logs) {
      if (l.pooled === true && l.itemId) {
        await applyPooledTransition(ctx, { ...l, itemId: l.itemId }, -1);
      }
      await ctx.db.delete("log_entries", l._id);
    }
    const answers = await ctx.db.query("answers").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(50);
    for (const a of answers) {
      const reviews = await ctx.db.query("answer_reviews").withIndex("by_answerId", (q) => q.eq("answerId", a._id)).take(10);
      for (const r of reviews) await ctx.db.delete("answer_reviews", r._id);
      if (a.input.photoId) await ctx.storage.delete(a.input.photoId);
      await ctx.db.delete("answers", a._id);
    }
    const votes = await ctx.db.query("swap_votes").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const vote of votes) {
      const s = await ctx.db.get("swaps", vote.swapId);
      if (s) await ctx.db.patch("swaps", s._id, { upvotes: Math.max(0, s.upvotes - 1) });
      await ctx.db.delete("swap_votes", vote._id);
    }
    const swaps = await ctx.db.query("swaps").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const s of swaps) await ctx.db.delete("swaps", s._id);
    const care = await ctx.db.query("care_team_answers").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const c of care) await ctx.db.delete("care_team_answers", c._id);
    const questions = await ctx.db.query("questions").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const q of questions) await ctx.db.delete("questions", q._id);
    const meds = await ctx.db.query("meds").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(50);
    for (const m of meds) await ctx.db.delete("meds", m._id);

    const more = logs.length === BATCH || answers.length === 50 || votes.length === BATCH || swaps.length === BATCH || care.length === BATCH || questions.length === BATCH;
    if (more) return { done: false };
    await ctx.db.delete("profiles", p._id);
    return { done: true };
  },
});

export const getById = internalQuery({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const p = await ctx.db.get("profiles", args.profileId);
    if (!p) return null;
    const meds = await ctx.db
      .query("meds")
      .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
      .take(50);
    return {
      role: p.role,
      anatomy: p.anatomy,
      anatomyKey: p.anatomyKey,
      anatomyText: describeAnatomy(p.anatomy),
      language: p.language,
      caresFor: p.role === "caregiver" ? (p.caresFor ?? null) : null,
      meds: meds.map((m) => ({ name: m.name, dosageForm: m.dosageForm ?? null })),
    };
  },
});
