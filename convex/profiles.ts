import { ConvexError, v } from "convex/values";
import {
  env,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { anatomyValidator, roleValidator } from "./schema";
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
      await ctx.db.insert("meds", { ...rest, profileId, addedAt: Date.now() });
    }
    return null;
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
      meds: meds.map((m) => ({ name: m.name, dosageForm: m.dosageForm ?? null })),
    };
  },
});
