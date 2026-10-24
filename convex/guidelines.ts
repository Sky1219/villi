import { v } from "convex/values";
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { hashText, voyageEmbed } from "./lib/embed";
import corpus from "../data/guidelines.json";

type CorpusChunk = (typeof corpus.chunks)[number] & {
  quote?: string;
  appliesTo?: string;
  diagram?: { segmentIds: string[]; mode: "absorbs-here" | "releases-here" | "missing"; label: string };
};

export function corpusChunks() {
  const sources = corpus.sources as Record<string, { title: string; url: string }>;
  return (corpus.chunks as CorpusChunk[]).map((c) => {
    const src = sources[c.sourceId];
    if (!src) throw new Error(`unknown source ${c.sourceId}`);
    return {
      chunkId: `${c.sourceId}#${c.locator}`,
      sourceId: c.sourceId,
      sourceTitle: src.title,
      sourceUrl: src.url,
      locator: c.locator,
      text: c.text,
      quote: c.quote,
      tags: c.tags,
      anatomyScope: c.anatomyScope,
      appliesTo: c.appliesTo,
      diagram: c.diagram,
      verified: false,
      contentHash: hashText(c.text + c.tags.join(",")),
    };
  });
}

// Idempotent: unchanged chunks keep their embedding; changed text drops it.
export const syncCorpus = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    const ids = new Set<string>();
    for (const c of corpusChunks()) {
      ids.add(c.chunkId);
      const existing = await ctx.db
        .query("guideline_chunks")
        .withIndex("by_chunkId", (q) => q.eq("chunkId", c.chunkId))
        .unique();
      if (!existing) {
        await ctx.db.insert("guideline_chunks", c);
        inserted++;
      } else if (existing.contentHash !== c.contentHash) {
        await ctx.db.replace("guideline_chunks", existing._id, c);
        updated++;
      } else {
        await ctx.db.patch("guideline_chunks", existing._id, {
          sourceTitle: c.sourceTitle,
          sourceUrl: c.sourceUrl,
          diagram: c.diagram,
          anatomyScope: c.anatomyScope,
          appliesTo: c.appliesTo,
        });
      }
    }
    let removed = 0;
    for await (const row of ctx.db.query("guideline_chunks")) {
      if (!ids.has(row.chunkId)) {
        await ctx.db.delete("guideline_chunks", row._id);
        removed++;
      }
    }
    return { inserted, updated, removed };
  },
});

export const missingEmbeddings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: { _id: Id<"guideline_chunks">; text: string }[] = [];
    for await (const row of ctx.db.query("guideline_chunks")) {
      if (!row.embedding) out.push({ _id: row._id, text: `${row.text}\nTags: ${row.tags.join(", ")}` });
    }
    return out;
  },
});

export const setEmbeddings = internalMutation({
  args: {
    rows: v.array(v.object({ id: v.id("guideline_chunks"), embedding: v.array(v.float64()) })),
  },
  handler: async (ctx, args) => {
    for (const r of args.rows) await ctx.db.patch("guideline_chunks", r.id, { embedding: r.embedding });
    return null;
  },
});

export const embedMissing = internalAction({
  args: {},
  handler: async (ctx): Promise<{ embedded: number; skipped: string | null }> => {
    const rows: { _id: Id<"guideline_chunks">; text: string }[] = await ctx.runQuery(
      internal.guidelines.missingEmbeddings,
      {},
    );
    if (rows.length === 0) return { embedded: 0, skipped: null };
    if (!env.VOYAGE_API_KEY) return { embedded: 0, skipped: "no VOYAGE_API_KEY (full-text search only)" };
    try {
      const vectors = await voyageEmbed(env.VOYAGE_API_KEY, rows.map((r) => r.text), "document");
      await ctx.runMutation(internal.guidelines.setEmbeddings, {
        rows: rows.map((r, i) => ({ id: r._id, embedding: vectors[i] })),
      });
      return { embedded: rows.length, skipped: null };
    } catch (e) {
      return { embedded: 0, skipped: `voyage failed: ${(e as Error).message}` };
    }
  },
});

export type ChunkView = {
  chunkId: string;
  sourceTitle: string;
  sourceUrl: string;
  text: string;
  anatomyScope: string[];
  appliesTo: string | null;
  diagram: Doc<"guideline_chunks">["diagram"] | null;
};

function view(c: Doc<"guideline_chunks">): ChunkView {
  return {
    chunkId: c.chunkId,
    sourceTitle: c.sourceTitle,
    sourceUrl: c.sourceUrl,
    text: c.text,
    anatomyScope: c.anatomyScope,
    appliesTo: c.appliesTo ?? null,
    diagram: c.diagram ?? null,
  };
}

export const hydrate = internalQuery({
  args: { ids: v.array(v.id("guideline_chunks")) },
  handler: async (ctx, args) => {
    const out: ChunkView[] = [];
    for (const id of args.ids) {
      const c = await ctx.db.get("guideline_chunks", id);
      if (c) out.push(view(c));
    }
    return out;
  },
});

export const textSearch = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("guideline_chunks")
      .withSearchIndex("search_text", (q) => q.search("text", args.query))
      .take(30);
    return rows.map(view);
  },
});

// Chunks whose tags match a term exactly. Release-form rules are mandatory for
// pill queries, so they are included even when ranking would miss them.
export const byTags = internalQuery({
  args: { tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const out: ChunkView[] = [];
    for await (const row of ctx.db.query("guideline_chunks")) {
      if (row.tags.some((t) => args.tags.includes(t))) out.push(view(row));
    }
    return out;
  },
});

export const byChunkIds = internalQuery({
  args: { chunkIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const out: ChunkView[] = [];
    for (const chunkId of args.chunkIds) {
      const c = await ctx.db
        .query("guideline_chunks")
        .withIndex("by_chunkId", (q) => q.eq("chunkId", chunkId))
        .unique();
      if (c) out.push(view(c));
    }
    return out;
  },
});

const TAG_WORDS = [
  "extended-release",
  "sustained-release",
  "delayed-release",
  "enteric-coated",
  "sorbitol",
  "xylitol",
  "mannitol",
  "sugar-alcohol",
  "liquid",
  "crushing",
  "hypotonic",
  "hypertonic",
  "ors",
  "sports-drink",
  "tablet-in-pouch",
];

// search_guidelines: Voyage vector search with an automatic full-text fallback.
// Filters by the user's anatomy scope after hydration and reports which path ran.
export const search = internalAction({
  args: { query: v.string(), scopeTags: v.array(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ path: "vector" | "text"; note: string | null; chunks: ChunkView[] }> => {
    const limit = args.limit ?? 6;
    const inScope = (c: ChunkView) => c.anatomyScope.some((s) => args.scopeTags.includes(s));
    let path: "vector" | "text" = "text";
    let note: string | null = null;
    let ranked: ChunkView[] = [];

    if (env.VOYAGE_API_KEY) {
      try {
        const [vector] = await voyageEmbed(env.VOYAGE_API_KEY, [args.query], "query");
        const hits = await ctx.vectorSearch("guideline_chunks", "by_embedding", { vector, limit: 50 });
        if (hits.length > 0) {
          ranked = await ctx.runQuery(internal.guidelines.hydrate, { ids: hits.map((h) => h._id) });
          path = "vector";
        } else {
          note = "no embeddings stored; used full-text";
        }
      } catch (e) {
        note = `embedding failed (${(e as Error).message}); used full-text`;
      }
    } else {
      note = "no embeddings key; used full-text";
    }
    if (path === "text") {
      ranked = await ctx.runQuery(internal.guidelines.textSearch, { query: args.query });
    }

    const q = args.query.toLowerCase();
    const mandatoryTags = TAG_WORDS.filter((t) => q.includes(t) || q.includes(t.replace("-", " ")));
    const mandatory = mandatoryTags.length
      ? await ctx.runQuery(internal.guidelines.byTags, { tags: mandatoryTags })
      : [];

    const seen = new Set<string>();
    const out: ChunkView[] = [];
    for (const c of [...mandatory, ...ranked]) {
      if (seen.has(c.chunkId) || !inScope(c)) continue;
      seen.add(c.chunkId);
      out.push(c);
    }
    return { path, note, chunks: out.slice(0, Math.max(limit, mandatory.length)) };
  },
});
