import { v } from "convex/values";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { categoryValidator } from "./schema";
import { anthropicClient, fastModel } from "./lib/llm";

type Category = "pill" | "drink" | "food" | "action";
export type Canonical = {
  itemId: Id<"items">;
  canonicalName: string;
  category: Category;
  attributes: Doc<"items">["attributes"];
  path: "exact" | "model-match" | "created";
};

const RELEASE_WORDS = /\b(er|xl|xr|sr|cr|dr|ec|extended|sustained|delayed|enteric)\b/i;

const CanonSchema = z.object({
  matchCanonicalName: z.string().nullable(),
  canonicalName: z.string(),
  category: z.enum(["pill", "drink", "food", "action"]),
  tonicity: z.enum(["hypotonic", "hypertonic", "ors", "salty", "none"]),
  simpleSugar: z.boolean(),
  sugarAlcohol: z.string().nullable(),
  caffeine: z.boolean(),
  releaseForm: z.enum(["extended-release", "delayed-release", "immediate-release", "liquid", "none"]),
  thickening: z.boolean(),
  lactose: z.boolean(),
});

const CANON_SYSTEM = `You map what a user typed (in any language) to a canonical item for an app about short bowel syndrome and ostomies. Choose matchCanonicalName ONLY from the catalog when it is the same thing (aliases, brands, translations, spelling). A medicine with different release wording (ER/XL/SR vs immediate-release, DR/EC) is a DIFFERENT item: never match across release forms. Preparations and serving forms of a catalog item are that item: frozen, chilled, flavored, homemade, diluted, "ice pops", "over ice", a brand of it (e.g. "ORS ice pops" and "Pedialyte popsicles" -> oral rehydration solution; "Coca-Cola" -> cola; "jasmine rice" -> white rice). Otherwise set matchCanonicalName=null and give a new canonicalName: short, lowercase, English, generic (e.g. "cola", "sports drink", "metoprolol succinate er"). Fill the attributes from general knowledge of the item; simpleSugar means a lot of added or free sugar (soda, juice, candy), not small amounts in ORS or fruit; use "none"/false when not applicable.`;

// Builder-only cleanup for a bad catalog entry and anything pointing at it.
export const removeItem = internalMutation({
  args: { canonicalName: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("items")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", args.canonicalName))
      .unique();
    if (!item) return { removed: 0 };
    let removed = 0;
    for await (const s of ctx.db.query("swaps")) {
      if ((s.useItemId === item._id || s.insteadOfItemId === item._id) && !s.synthetic) {
        await ctx.db.delete("swaps", s._id);
        removed++;
      }
    }
    await ctx.db.delete("items", item._id);
    return { removed };
  },
});

export const catalog = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("items").take(300);
    return rows.map((r) => ({ _id: r._id, canonicalName: r.canonicalName, category: r.category, aliases: r.aliases, attributes: r.attributes }));
  },
});

export const insertItem = internalMutation({
  args: {
    canonicalName: v.string(),
    category: categoryValidator,
    attributes: v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.array(v.string()))),
    alias: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("items")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", args.canonicalName))
      .unique();
    if (existing) return existing._id;
    const aliases = args.alias && args.alias !== args.canonicalName ? [args.alias] : [];
    return await ctx.db.insert("items", {
      canonicalName: args.canonicalName,
      category: args.category,
      attributes: args.attributes,
      aliases,
      searchText: [args.canonicalName, ...aliases].join(" "),
      synthetic: false,
    });
  },
});

export const addAlias = internalMutation({
  args: { itemId: v.id("items"), alias: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get("items", args.itemId);
    if (!item || item.aliases.includes(args.alias) || item.canonicalName === args.alias || item.aliases.length >= 40) return null;
    const aliases = [...item.aliases, args.alias];
    await ctx.db.patch("items", item._id, { aliases, searchText: [item.canonicalName, ...aliases].join(" ") });
    return null;
  },
});

// canonicalize_item: checks the existing catalog first (exact name or alias),
// then asks the fast model to match or create. Never merges across release form.
export const run = internalAction({
  args: { text: v.string(), categoryHint: v.optional(categoryValidator) },
  handler: async (ctx, args): Promise<Canonical> => {
    const text = args.text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
    const items: { _id: Id<"items">; canonicalName: string; category: Category; aliases: string[]; attributes: Doc<"items">["attributes"] }[] =
      await ctx.runQuery(internal.canonicalize.catalog, {});
    const exact = items.find((i) => i.canonicalName === text || i.aliases.includes(text));
    if (exact) {
      return { itemId: exact._id, canonicalName: exact.canonicalName, category: exact.category, attributes: exact.attributes, path: "exact" };
    }

    const client = anthropicClient(env);
    const res = await client.messages.parse({
      model: fastModel(env),
      max_tokens: 2000,
      system: CANON_SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(CanonSchema) },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            typed: args.text.slice(0, 120),
            categoryHint: args.categoryHint ?? null,
            catalog: items.map((i) => ({ name: i.canonicalName, category: i.category, releaseForm: i.attributes.releaseForm ?? null })),
          }),
        },
      ],
    });
    const out = res.parsed_output;
    if (!out) throw new Error("could not canonicalize item");

    const match = out.matchCanonicalName ? items.find((i) => i.canonicalName === out.matchCanonicalName) : undefined;
    // Guard: the typed text's release wording must agree with the matched pill.
    const typedRelease = RELEASE_WORDS.test(text);
    const matchRelease = match?.attributes.releaseForm === "extended-release" || match?.attributes.releaseForm === "delayed-release";
    if (match && (match.category !== "pill" || typedRelease === matchRelease)) {
      await ctx.runMutation(internal.canonicalize.addAlias, { itemId: match._id, alias: text });
      return { itemId: match._id, canonicalName: match.canonicalName, category: match.category, attributes: match.attributes, path: "model-match" };
    }

    const attributes: Doc<"items">["attributes"] = {};
    if (out.tonicity !== "none") attributes.tonicity = out.tonicity;
    if (out.simpleSugar) attributes.simpleSugar = true;
    if (out.sugarAlcohol) attributes.sugarAlcohol = out.sugarAlcohol;
    if (out.caffeine) attributes.caffeine = true;
    if (out.releaseForm !== "none") attributes.releaseForm = out.releaseForm;
    if (out.thickening) attributes.thickening = true;
    if (out.lactose) attributes.lactose = true;
    const canonicalName = out.canonicalName.trim().toLowerCase().slice(0, 80) || text;
    const itemId: Id<"items"> = await ctx.runMutation(internal.canonicalize.insertItem, {
      canonicalName,
      category: out.category,
      attributes,
      alias: text,
    });
    return { itemId, canonicalName, category: out.category, attributes, path: "created" };
  },
});
