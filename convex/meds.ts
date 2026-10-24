import { ConvexError, v } from "convex/values";
import { env, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProfile } from "./profiles";
import { sawValidator } from "./schema";
import { joinPhotoName, readPhoto } from "./lib/vision";
import type { LabelResult } from "./fda";
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

export const enrich = internalAction({
  args: { medId: v.id("meds") },
  handler: async (ctx, args) => {
    const name: string | null = await ctx.runQuery(internal.meds.getMed, { medId: args.medId });
    if (!name || name.startsWith("Unreadable")) return null;
    const label: LabelResult = await ctx.runAction(internal.fda.fetchLabel, { name });
    await ctx.runMutation(internal.meds.setLabelInfo, {
      medId: args.medId,
      dosageForm: label.found ? (label.dosageForms[0] ?? "form not listed") : "no FDA label found",
      genericName: label.genericName?.toLowerCase() ?? undefined,
      fdaLabelKey: label.queryKey,
    });
    return null;
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
