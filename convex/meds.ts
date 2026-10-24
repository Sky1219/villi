import { ConvexError, v } from "convex/values";
import { env, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProfile } from "./profiles";
import { joinPhotoName, readPhoto } from "./lib/vision";
import type { LabelResult } from "./fda";

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
