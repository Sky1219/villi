import { v } from "convex/values";
import { env, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { voyageEmbed } from "./lib/embed";
import { fastModel } from "./lib/llm";

// `npm run preflight` (scripts/preflight.ts) runs this on the deployment you will demo.
// Every check runs server-side, so keys never leave Convex; results say only pass or fail.

type Check = { name: string; ok: boolean; detail: string };

export const counts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const chunks = await ctx.db.query("guideline_chunks").take(500);
    const templates = await Promise.all(
      ["father", "peer"].map(async (key) => {
        const t = await ctx.db.query("profiles").withIndex("by_templateKey", (q) => q.eq("templateKey", key)).first();
        const meds = t ? await ctx.db.query("meds").withIndex("by_profileId", (q) => q.eq("profileId", t._id)).take(50) : [];
        return { key, found: !!t, meds: meds.length };
      }),
    );
    const synthetic = await ctx.db.query("profiles").withIndex("by_synthetic", (q) => q.eq("synthetic", true)).take(200);
    return {
      chunks: chunks.length,
      embedded: chunks.filter((c) => c.embedding && c.embedding.length > 0).length,
      templates,
      syntheticProfiles: synthetic.length,
    };
  },
});

export const check = internalAction({
  args: { model: v.boolean() },
  handler: async (ctx, args): Promise<Check[]> => {
    const out: Check[] = [];
    const set = (name: string) => !!(env as Record<string, string | undefined>)[name];

    for (const name of ["ANTHROPIC_API_KEY", "OPENFDA_API_KEY", "VOYAGE_API_KEY"]) {
      out.push({ name: `${name} set`, ok: set(name), detail: set(name) ? "set" : "missing: npx convex env set " + name });
    }
    out.push({
      name: "Models",
      ok: true,
      detail: `main ${env.ANTHROPIC_MODEL_MAIN || "claude-sonnet-5-5 (default)"}, reviewer ${env.ANTHROPIC_MODEL_REVIEWER || "same as main"}, fast ${env.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5 (default)"}`,
    });
    out.push({ name: "Demo profiles on", ok: env.DEMO_MODE !== "off", detail: env.DEMO_MODE === "off" ? "DEMO_MODE is off" : "on" });

    const c: { chunks: number; embedded: number; templates: { key: string; found: boolean; meds: number }[]; syntheticProfiles: number } =
      await ctx.runQuery(internal.preflight.counts, {});
    out.push({ name: "Guidelines seeded", ok: c.chunks >= 40, detail: `${c.chunks} chunks, ${c.embedded} with embeddings` });
    out.push({ name: "Guideline embeddings", ok: c.embedded === c.chunks && c.chunks > 0, detail: c.embedded === c.chunks ? "all embedded" : "some missing: search falls back to keywords" });
    for (const t of c.templates) {
      out.push({ name: `Demo template "${t.key}"`, ok: t.found && t.meds > 0, detail: t.found ? `${t.meds} medicines` : "missing: run seed:run" });
    }
    out.push({ name: "Demo community seeded", ok: c.syntheticProfiles >= 50, detail: `${c.syntheticProfiles} synthetic profiles` });

    // openFDA: one label lookup with the deployment's key.
    try {
      const key = env.OPENFDA_API_KEY ? `&api_key=${env.OPENFDA_API_KEY}` : "";
      const res = await fetch(`https://api.fda.gov/drug/ndc.json?search=generic_name:%22metoprolol+succinate%22&limit=1${key}`);
      out.push({ name: "openFDA reachable", ok: res.ok, detail: res.ok ? "label lookup works" : `HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}` });
    } catch (e) {
      out.push({ name: "openFDA reachable", ok: false, detail: String(e).slice(0, 120) });
    }

    // Voyage: one tiny query embedding (free-tier tokens).
    if (env.VOYAGE_API_KEY) {
      try {
        await voyageEmbed(env.VOYAGE_API_KEY, ["preflight"], "query");
        out.push({ name: "Voyage embeddings", ok: true, detail: "query embedding works" });
      } catch (e) {
        out.push({ name: "Voyage embeddings", ok: false, detail: `${String(e).slice(0, 100)}: search falls back to keywords` });
      }
    }

    // Anthropic: one 1-token Haiku call, only with --model, because it spends credits.
    if (args.model && env.ANTHROPIC_API_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: fastModel(env), max_tokens: 1, messages: [{ role: "user", content: "ok" }] }),
      });
      const body = res.ok ? "" : await res.text();
      out.push({
        name: "Anthropic key has credit",
        ok: res.ok,
        detail: res.ok ? "1-token call worked" : /credit balance/i.test(body) ? "credit balance too low" : `HTTP ${res.status}`,
      });
    } else {
      out.push({ name: "Anthropic key has credit", ok: true, detail: "not checked (add --model; spends one token)" });
    }
    return out;
  },
});
