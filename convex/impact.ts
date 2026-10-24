import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireProfile } from "./profiles";
import { statusOf } from "./questions";
import { tallyImpact, type ImpactEvent } from "./lib/impact";

// Bounded scans are fine at hackathon scale; at production scale these become
// counter rows updated in the same mutations, like `aggregates`.
const LIMIT = 2000;

// One live query behind "Is Villi working?". Counts only, never anyone's text.
export const summary = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    await requireProfile(ctx, args.anonId);
    const profiles = new Map<Id<"profiles">, Doc<"profiles"> | null>();
    const profileOf = async (id: Id<"profiles">) => {
      if (!profiles.has(id)) profiles.set(id, await ctx.db.get("profiles", id));
      return profiles.get(id)!;
    };

    const events: ImpactEvent[] = [];
    let rated = 0;
    let useful = 0;

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_status", (q) => q.eq("status", "final"))
      .take(LIMIT);
    for (const a of answers) {
      if (a.kind !== "scan") continue;
      const p = await profileOf(a.profileId);
      if (!p || p.role === "clinician") continue;
      if ((a.final as { state?: string } | undefined)?.state === "flagged") {
        events.push({ metric: "flagsRaised", anatomyKey: p.anatomyKey, synthetic: p.synthetic });
      }
      if (a.useful !== undefined) {
        rated++;
        if (a.useful) useful++;
      }
    }

    for (const q of await ctx.db.query("questions").take(LIMIT)) {
      if (statusOf(q) === "open") continue;
      const p = await profileOf(q.profileId);
      if (p) events.push({ metric: "questionsAsked", anatomyKey: p.anatomyKey, synthetic: q.synthetic });
    }

    for (const c of await ctx.db.query("care_team_answers").take(LIMIT)) {
      const base = { anatomyKey: c.anatomyKey, synthetic: c.synthetic };
      events.push({ metric: "answersLogged", ...base });
      if (c.resultingChange === "formulation_changed") events.push({ metric: "formulationChanged", ...base });
      if (c.resultingChange === "dose_monitored") events.push({ metric: "monitored", ...base });
    }

    return { metrics: tallyImpact(events), useful: { yes: useful, rated } };
  },
});
