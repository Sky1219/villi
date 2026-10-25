import { ConvexError, v } from "convex/values";
import { env, internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProfile } from "./profiles";
import { sawValidator } from "./schema";
import { joinPhotoName, readPhoto } from "./lib/vision";
import { labelKeyFor, type LabelResult } from "./fda";
import type { Doc } from "./_generated/dataModel";
import { reviewMed, type MedReview } from "./lib/medReview";
import { scopeTagsFor } from "./lib/anatomy";
import { matchPills, type MedForMatch, type PillMatch } from "./lib/pillMatch";

const MAX_MEDS = 30;

export const add = mutation({
  args: { anonId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const name = args.name.trim().slice(0, 120);
    if (!name) throw new ConvexError("Type the name on the label.");
    const existing = await ctx.db
      .query("meds")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .take(MAX_MEDS + 1);
    if (existing.length >= MAX_MEDS) throw new ConvexError("That's the most medicines Villi can keep.");
    const medId = await ctx.db.insert("meds", { profileId: profile._id, name, addedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.meds.enrich, { medId });
    return medId;
  },
});

export const addFromPhoto = mutation({
  args: { anonId: v.string(), photoId: v.id("_storage") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    await ctx.scheduler.runAfter(0, internal.meds.readAndAdd, { profileId: profile._id, photoId: args.photoId });
    return null;
  },
});

export const remove = mutation({
  args: { anonId: v.string(), medId: v.id("meds") },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const med = await ctx.db.get("meds", args.medId);
    if (!med || med.profileId !== profile._id) throw new ConvexError("Not found");
    await ctx.db.delete("meds", med._id);
    return null;
  },
});

// "Did you know this already?" on a flagged review row. The review state is recomputed
// from the label, so this is stored on the med and only counted while the row is flagged.
export const markKnewBefore = mutation({
  args: { anonId: v.string(), medId: v.id("meds"), knew: v.union(v.boolean(), v.null()) },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    const med = await ctx.db.get("meds", args.medId);
    if (!med || med.profileId !== profile._id) throw new ConvexError("Not found");
    await ctx.db.patch("meds", med._id, { knewBefore: args.knew ?? undefined });
    return null;
  },
});

export const insertRead = internalMutation({
  args: { profileId: v.id("profiles"), name: v.string() },
  handler: async (ctx, args) => {
    const medId = await ctx.db.insert("meds", { profileId: args.profileId, name: args.name.slice(0, 120), addedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.meds.enrich, { medId });
    return null;
  },
});

export const deletePhoto = internalMutation({
  args: { photoId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.photoId);
    return null;
  },
});

// Vision -> name -> label lookup. The photo is deleted whatever happens.
export const readAndAdd = internalAction({
  args: { profileId: v.id("profiles"), photoId: v.id("_storage") },
  handler: async (ctx, args) => {
    try {
      const url = await ctx.storage.getUrl(args.photoId);
      const seen = url ? await readPhoto(env, url) : null;
      const name = seen?.legible && seen.name ? joinPhotoName(seen) : "Unreadable photo: type the name";
      await ctx.runMutation(internal.meds.insertRead, { profileId: args.profileId, name });
    } finally {
      await ctx.runMutation(internal.meds.deletePhoto, { photoId: args.photoId });
    }
    return null;
  },
});

export const setLabelInfo = internalMutation({
  args: { medId: v.id("meds"), dosageForm: v.string(), genericName: v.optional(v.string()), fdaLabelKey: v.string() },
  handler: async (ctx, args) => {
    const med = await ctx.db.get("meds", args.medId);
    if (!med) return null;
    await ctx.db.patch("meds", med._id, { dosageForm: args.dosageForm, genericName: args.genericName, fdaLabelKey: args.fdaLabelKey });
    return null;
  },
});

export const getMed = internalQuery({
  args: { medId: v.id("meds") },
  handler: async (ctx, args) => (await ctx.db.get("meds", args.medId))?.name ?? null,
});

// Scheduled whenever a med is added (typed, photo or demo clone), so the
// medicine list review has the label ready by the time the list renders.
export const enrich = internalAction({
  args: { medId: v.id("meds"), attempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const name: string | null = await ctx.runQuery(internal.meds.getMed, { medId: args.medId });
    if (!name || name.startsWith("Unreadable")) return null;
    // The medicine list review reads the cached label sections, so skip the drug table here:
    // a table hit returns facts without writing the label cache.
    const label: LabelResult = await ctx.runAction(internal.fda.fetchLabel, { name, needFullText: true });
    // A rate limit or outage is not "no label": leave the med unchecked and try again.
    if (label.error && !label.fromCache) {
      const attempt = args.attempt ?? 0;
      if (attempt < 3) await ctx.scheduler.runAfter(60_000 * (attempt + 1), internal.meds.enrich, { medId: args.medId, attempt: attempt + 1 });
      return null;
    }
    await ctx.runMutation(internal.meds.setLabelInfo, {
      medId: args.medId,
      dosageForm: label.found ? (label.dosageForms[0] ?? "form not listed") : "no FDA label found",
      genericName: label.genericName?.toLowerCase() ?? undefined,
      fdaLabelKey: label.queryKey,
    });
    return null;
  },
});

export type MedReviewRow = MedReview & {
  _id: Doc<"meds">["_id"];
  name: string;
  dosageForm: string | null;
  labelSource: string | null;
  knewBefore: boolean | null;
};

// One row per med on file, from the cached label only: instant, no model call.
export async function medReviewRows(ctx: QueryCtx, profile: Doc<"profiles">): Promise<MedReviewRow[]> {
  const meds = await ctx.db
    .query("meds")
    .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
    .take(MAX_MEDS);
  const tags = scopeTagsFor(profile.anatomy);
  const rows: MedReviewRow[] = [];
  for (const m of meds) {
    // No cache row yet means the label lookup hasn't finished: "Label not checked yet".
    const cached = await ctx.db
      .query("fda_label_cache")
      .withIndex("by_queryKey", (q) => q.eq("queryKey", m.fdaLabelKey ?? labelKeyFor(m.name)))
      .unique();
    const dosageForm = cached?.dosageForms[0] ?? (cached?.found ? (m.dosageForm ?? null) : null);
    const review = reviewMed({
      name: m.name,
      dosageForm,
      label: cached ? { found: cached.found, sections: cached.sections } : null,
      scopeTags: tags,
    });
    rows.push({
      ...review,
      _id: m._id,
      name: m.name,
      dosageForm,
      labelSource: cached?.found ? `${cached.brandName ?? cached.genericName ?? ""} (${cached.manufacturer ?? "?"}, ${cached.effectiveTime ?? "?"})` : null,
      knewBefore: m.knewBefore ?? null,
    });
  }
  return rows;
}

// "Medicine list review" on the home screen.
export const review = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const profile = await requireProfile(ctx, args.anonId);
    return await medReviewRows(ctx, profile);
  },
});

export const listForProfile = internalQuery({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const meds = await ctx.db
      .query("meds")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .take(MAX_MEDS);
    return meds.map((m) => ({ name: m.name, dosageForm: m.dosageForm ?? null }));
  },
});


// match_pill: closed set, this profile's own meds only.
export const matchPill = internalAction({
  args: { profileId: v.id("profiles"), saw: sawValidator },
  handler: async (ctx, args): Promise<{ matches: PillMatch[]; checked: number; labels: Record<string, LabelResult> }> => {
    const meds: { name: string; dosageForm: string | null }[] = await ctx.runQuery(internal.meds.listForProfile, {
      profileId: args.profileId,
    });
    const labels: Record<string, LabelResult> = {};
    const forMatch: MedForMatch[] = await Promise.all(
      meds.map(async (m) => {
        const label: LabelResult = await ctx.runAction(internal.fda.fetchLabel, { name: m.name, needFullText: true });
        labels[m.name] = label;
        const s = label.sections;
        return {
          name: m.name,
          dosageForm: label.dosageForms[0] ?? m.dosageForm,
          releaseForm: label.releaseForm,
          labelText: [s.how_supplied, s.dosage_forms_and_strengths, s.description, s.spl_unclassified_section].filter(Boolean).join(" "),
        };
      }),
    );
    return { matches: matchPills(args.saw, forMatch), checked: meds.length, labels };
  },
});
