import { v } from "convex/values";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { runIdValidator, runResultValidator } from "@convex-dev/action-retrier";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { anthropicClient, fastModel } from "./lib/llm";
import { MODERATION_SYSTEM, ModerationSchema, moderateText, type ModerationDecision } from "./lib/moderation";
import { applyPooledTransition } from "./community";
import type { Canonical } from "./canonicalize";
import { MODERATION_FIXTURES } from "./lib/moderationFixtures";

export async function claudeModerate(text: string, system: string = MODERATION_SYSTEM): Promise<ModerationDecision> {
  const client = anthropicClient(env);
  const res = await client.messages.parse({
    model: fastModel(env),
    max_tokens: 1000,
    system,
    output_config: { effort: "low", format: zodOutputFormat(ModerationSchema) },
    messages: [{ role: "user", content: `<entry>\n${text.slice(0, 600)}\n</entry>` }],
  });
  if (res.stop_reason === "refusal") return { pooled: false, reason: "moderator declined", nudgeUser: null };
  if (!res.parsed_output) throw new Error("moderation returned nothing");
  return res.parsed_output;
}

export const getLog = internalQuery({
  args: { logId: v.id("log_entries") },
  handler: async (ctx, args) => await ctx.db.get("log_entries", args.logId),
});

export const applyLog = internalMutation({
  args: {
    logId: v.id("log_entries"),
    itemId: v.optional(v.id("items")),
    pooled: v.boolean(),
    reason: v.union(v.string(), v.null()),
    nudge: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get("log_entries", args.logId);
    if (!log || log.pooled !== null) return null; // idempotent under retries
    const itemId = log.itemId ?? args.itemId;
    // Without a canonical item it cannot be counted, so it stays with the author.
    const pooled = args.pooled && !!itemId;
    await ctx.db.patch("log_entries", log._id, {
      itemId,
      pooled,
      moderationReason: args.reason ?? (itemId ? undefined : "could not identify the item"),
      nudgeUser: pooled ? undefined : (args.nudge ?? undefined),
    });
    if (pooled && itemId) {
      await applyPooledTransition(ctx, { itemId, anatomyKey: log.anatomyKey, outcome: log.outcome, synthetic: log.synthetic }, 1);
    }
    return null;
  },
});

// Scheduled from logs.create through the retrier. Canonicalize, screen, apply.
export const moderateLog = internalAction({
  args: { logId: v.id("log_entries") },
  handler: async (ctx, args): Promise<null> => {
    const log: Doc<"log_entries"> | null = await ctx.runQuery(internal.moderation.getLog, { logId: args.logId });
    if (!log || log.pooled !== null) return null;
    let itemId: Id<"items"> | undefined = log.itemId;
    if (!itemId && log.itemText) {
      const c: Canonical = await ctx.runAction(internal.canonicalize.run, { text: log.itemText });
      itemId = c.itemId;
    }
    const text = [log.itemText, log.note].filter(Boolean).join("\n");
    // A bare outcome on a known item has no free text to screen.
    const d = text ? await moderateText(text, (t) => claudeModerate(t)) : { pooled: true, reason: null, nudgeUser: null };
    await ctx.runMutation(internal.moderation.applyLog, {
      logId: args.logId,
      itemId,
      pooled: d.pooled,
      reason: d.reason,
      nudge: d.nudgeUser,
    });
    return null;
  },
});

// Retries exhausted: fail closed. The entry stays visible to its author only.
export const onLogModerated = internalMutation({
  args: { runId: runIdValidator, result: runResultValidator },
  handler: async (ctx, args) => {
    if (args.result.type === "success") return null;
    const log = await ctx.db
      .query("log_entries")
      .withIndex("by_moderationRunId", (q) => q.eq("moderationRunId", args.runId))
      .unique();
    if (!log || log.pooled !== null) return null;
    await ctx.db.patch("log_entries", log._id, {
      pooled: false,
      moderationReason: "moderation unavailable",
    });
    return null;
  },
});

// `npx convex run moderation:evalFixtures`: the Claude moderator alone (rules off) on the fixtures.
export const evalFixtures = internalAction({
  args: {},
  handler: async () => {
    const rows = await Promise.all(
      MODERATION_FIXTURES.map(async (f) => {
        const d = await claudeModerate(f.text);
        return { text: f.text, expected: f.pooled, got: d.pooled, reason: d.reason };
      }),
    );
    return { correct: rows.filter((r) => r.expected === r.got).length, total: rows.length, misses: rows.filter((r) => r.expected !== r.got) };
  },
});
