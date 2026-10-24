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
import { applyCareOutcomeTransition, applyPooledTransition } from "./community";
import { SEGMENTS, anatomyKeyOf, defaultDiagram, describeAnatomy, type DiagramState, type SegmentId } from "./lib/anatomy";
import type { Doc, Id } from "./_generated/dataModel";
import { anatomyQuestionFor, type CaresFor } from "./lib/careFor";

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

// "I don't know my anatomy" starts the sheet with the question that settles it.
async function ensureAnatomyQuestion(ctx: MutationCtx, profileId: Id<"profiles">, role: string, caresFor: CaresFor | undefined) {
  const text = anatomyQuestionFor(role, caresFor);
  const existing = await ctx.db.query("questions").withIndex("by_profileId", (q) => q.eq("profileId", profileId)).take(100);
  if (existing.some((q) => q.text === text)) return;
  await ctx.db.insert("questions", {
    profileId,
    text,
    context: {},
    resolved: false,
    status: "open",
    synthetic: false,
    createdAt: Date.now(),
  });
}

async function findProfile(ctx: QueryCtx | MutationCtx, anonId: string) {
  if (anonId.length < 20) return null;
  const own = await ctx.db
    .query("profiles")
    .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
    .unique();
  if (own) return own;
  // A second phone linked with a code reaches the same profile through its own anonId.
  const link = await ctx.db
    .query("device_links")
    .withIndex("by_anonId", (q) => q.eq("anonId", anonId))
    .unique();
  return link ? await ctx.db.get("profiles", link.profileId) : null;
}

// ---- "Use Villi on another phone"

const CODE_MS = 10 * 60_000;
const MAX_DEVICES = 5;

function sixDigits(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

export const createDeviceCode = mutation({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const p = await requireProfile(ctx, args.anonId);
    const now = Date.now();
    const recent = await ctx.db
      .query("device_codes")
      .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
      .order("desc")
      .take(10);
    if (recent.filter((c) => c.createdAt > now - 3_600_000).length >= 5) {
      throw new ConvexError("That's a lot of codes in an hour. Try again later.");
    }
    const links = await ctx.db.query("device_links").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(MAX_DEVICES + 1);
    if (links.length >= MAX_DEVICES) throw new ConvexError("This profile is already on 5 other phones. Remove one first.");
    // Older unused codes stop working when a new one is made.
    for (const c of recent) if (!c.usedAt && c.expiresAt > now) await ctx.db.patch("device_codes", c._id, { expiresAt: now });
    let code = sixDigits();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db.query("device_codes").withIndex("by_code", (q) => q.eq("code", code)).take(5);
      if (!clash.some((c) => !c.usedAt && c.expiresAt > now)) break;
      code = sixDigits();
    }
    await ctx.db.insert("device_codes", { profileId: p._id, code, createdAt: now, expiresAt: now + CODE_MS });
    return { code, expiresAt: now + CODE_MS };
  },
});

// Returns a result instead of throwing, so the attempt is recorded either way.
export const redeemDeviceCode = mutation({
  args: { anonId: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (args.anonId.length < 20) return { ok: false, reason: "bad device id" };
    const now = Date.now();
    const mine = await ctx.db
      .query("device_link_attempts")
      .withIndex("by_anonId_and_at", (q) => q.eq("anonId", args.anonId).gt("at", now - CODE_MS))
      .take(10);
    const everyone = await ctx.db
      .query("device_link_attempts")
      .withIndex("by_at", (q) => q.gt("at", now - CODE_MS))
      .take(200);
    if (mine.filter((a) => !a.ok).length >= 5 || everyone.filter((a) => !a.ok).length >= 100) {
      return { ok: false, reason: "Too many tries. Wait ten minutes and ask for a new code." };
    }
    const fail = async (reason: string) => {
      await ctx.db.insert("device_link_attempts", { anonId: args.anonId, ok: false, at: now });
      return { ok: false as const, reason };
    };
    if (await ctx.db.query("profiles").withIndex("by_anonId", (q) => q.eq("anonId", args.anonId)).unique()) {
      return { ok: false, reason: "This phone already has its own profile. Delete its data first, then enter the code." };
    }
    const code = args.code.replace(/\D/g, "");
    if (code.length !== 6) return await fail("Enter the 6-digit code.");
    const row = (await ctx.db.query("device_codes").withIndex("by_code", (q) => q.eq("code", code)).take(5)).find(
      (c) => !c.usedAt && c.expiresAt > now,
    );
    if (!row) return await fail("That code didn't work. Codes last ten minutes and work once.");
    await ctx.db.patch("device_codes", row._id, { usedAt: now });
    const existing = await ctx.db.query("device_links").withIndex("by_anonId", (q) => q.eq("anonId", args.anonId)).unique();
    if (existing) await ctx.db.delete("device_links", existing._id);
    await ctx.db.insert("device_links", { anonId: args.anonId, profileId: row.profileId, createdAt: now });
    await ctx.db.insert("device_link_attempts", { anonId: args.anonId, ok: true, at: now });
    return { ok: true };
  },
});

// The other phones on this profile. Never returns their anonIds.
export const listDevices = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const p = await requireProfile(ctx, args.anonId);
    const links = await ctx.db.query("device_links").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(MAX_DEVICES + 1);
    return {
      thisIsLinked: p.anonId !== args.anonId,
      devices: links.map((l) => ({ _id: l._id, createdAt: l.createdAt, isThisPhone: l.anonId === args.anonId })),
    };
  },
});

export const revokeDevice = mutation({
  args: { anonId: v.string(), linkId: v.id("device_links") },
  handler: async (ctx, args) => {
    const p = await requireProfile(ctx, args.anonId);
    const l = await ctx.db.get("device_links", args.linkId);
    if (!l || l.profileId !== p._id) throw new ConvexError("Phone not found");
    await ctx.db.delete("device_links", l._id);
    return null;
  },
});

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
    anatomyConfirmed: p.anatomyConfirmed !== false,
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
    anatomyConfirmed: v.optional(v.boolean()),
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
      anatomyConfirmed: args.anatomyConfirmed ?? true,
      // No clinician role is offered in the UI; real verification is a production task.
      clinicianDemoVerified: false,
    };
    let profileId = existing?._id;
    if (existing) await ctx.db.patch("profiles", existing._id, fields);
    else profileId = await ctx.db.insert("profiles", { anonId: args.anonId, ...fields, synthetic: false, createdAt: Date.now() });
    if (fields.anatomyConfirmed === false && profileId) await ensureAnatomyQuestion(ctx, profileId, fields.role, fields.caresFor);
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
    // The template's demo follow-up (synthetic, badged) so the two-week card can be shown.
    const templateQs = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", template._id))
      .take(10);
    const mine = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
      .take(100);
    for (const { _id, _creationTime, profileId: _tp, ...q } of templateQs) {
      if (!q.synthetic || !q.followUpDue || mine.some((m) => m.text === q.text)) continue;
      await ctx.db.insert("questions", { ...q, profileId });
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
    for (const c of care) {
      if (c.pooled === true && c.itemId && c.resultingChange) {
        await applyCareOutcomeTransition(ctx, { ...c, itemId: c.itemId, resultingChange: c.resultingChange }, -1);
      }
      await ctx.db.delete("care_team_answers", c._id);
    }
    const questions = await ctx.db.query("questions").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const q of questions) await ctx.db.delete("questions", q._id);
    const meds = await ctx.db.query("meds").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(50);
    for (const m of meds) await ctx.db.delete("meds", m._id);
    const links = await ctx.db.query("team_links").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const l of links) await ctx.db.delete("team_links", l._id);
    // Other phones linked to this profile lose access with it.
    const devices = await ctx.db.query("device_links").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const d of devices) await ctx.db.delete("device_links", d._id);
    const codes = await ctx.db.query("device_codes").withIndex("by_profileId", (q) => q.eq("profileId", p._id)).take(BATCH);
    for (const c of codes) await ctx.db.delete("device_codes", c._id);

    const more = logs.length === BATCH || answers.length === 50 || votes.length === BATCH || swaps.length === BATCH || care.length === BATCH || questions.length === BATCH || links.length === BATCH;
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
      diagram: diagramOf(p),
      language: p.language,
      caresFor: p.role === "caregiver" ? (p.caresFor ?? null) : null,
      anatomyConfirmed: p.anatomyConfirmed !== false,
      meds: meds.map((m) => ({ name: m.name, dosageForm: m.dosageForm ?? null })),
    };
  },
});
