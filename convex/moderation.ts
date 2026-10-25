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
import { retrier } from "./lib/retrier";
import { AGAINST_GUIDANCE_NUDGE } from "./lib/guidance";
import { guidanceConflict } from "./logs";

const NEW_PROFILE_MS = 10 * 60_000;
const NEW_PROFILE_NOTE_FREE = 3;

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
    // A good or neutral outcome for an item Villi flagged for this anatomy stays with its
    // author. Checked again now that a typed name has a catalog item.
    const profile = await ctx.db.get("profiles", log.profileId);
    const conflict =
      log.againstGuidance ??
      (profile && !log.synthetic ? await guidanceConflict(ctx, profile, { outcome: log.outcome, itemId, itemText: log.itemText }) : null);
    if (conflict) {
      await ctx.db.patch("log_entries", log._id, {
        itemId,
        pooled: false,
        againstGuidance: conflict,
        moderationReason: "against guidance for this anatomy",
        nudgeUser: AGAINST_GUIDANCE_NUDGE,
      });
      return null;
    }
    // A brand-new profile can share only a few note-free entries before its
    // first ten minutes are up; the rest wait for a re-check after the window.
    if (args.pooled && itemId && !log.note && !log.synthetic) {
      const p = await ctx.db.get("profiles", log.profileId);
      const age = p ? Date.now() - p.createdAt : Infinity;
      if (p && age < NEW_PROFILE_MS) {
        const recent = await ctx.db
          .query("log_entries")
          .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
          .order("desc")
          .take(50);
        if (recent.filter((l) => l.pooled === true && !l.note).length >= NEW_PROFILE_NOTE_FREE) {
          await ctx.db.patch("log_entries", log._id, { itemId, moderationReason: "waiting: new profile" });
          await ctx.scheduler.runAfter(NEW_PROFILE_MS - age + 1000, internal.moderation.recheckLog, { logId: log._id });
          return null;
        }
      }
    }
    // Without a canonical item it cannot be counted, so it stays with the author.
    const pooled = args.pooled && !!itemId;
    await ctx.db.patch("log_entries", log._id, {
      itemId,
      pooled,
      moderationReason: args.reason ?? (itemId ? undefined : "could not identify the item"),
      nudgeUser: pooled ? undefined : (args.nudge ?? undefined),
    });
    if (pooled && itemId) {
      await applyPooledTransition(ctx, { ...log, itemId }, 1);
    }
    return null;
  },
});

// Runs the normal moderation pass again once a new profile's window is over.
export const recheckLog = internalMutation({
  args: { logId: v.id("log_entries") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get("log_entries", args.logId);
    if (!log || log.pooled !== null) return null;
    const runId = await retrier.run(ctx, internal.moderation.moderateLog, { logId: log._id }, {
      onComplete: internal.moderation.onLogModerated,
    });
    await ctx.db.patch("log_entries", log._id, { moderationRunId: runId });
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
      itemId = c.itemId ?? undefined;
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
