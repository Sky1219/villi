import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireProfile } from "./profiles";
import { statusOf } from "./questions";
import { describeAnatomy } from "./lib/anatomy";
import { medReviewRows } from "./meds";
import { scanWarningSigns } from "./lib/warningSigns";

// Everything the appointment sheet shows, in one reactive query.
export const get = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);

    // Questions, with the care-team answer the user logged for each.
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .order("desc")
      .take(50);
    const answers = await ctx.db
      .query("care_team_answers")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .take(50);
    const answerFor = new Map(answers.map((a) => [a.questionId, a]));

    // Personal patterns: hypotheses from the user's own log, with counts.
    const logs = await ctx.db
      .query("log_entries")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .order("desc")
      .take(300);
    const byItem = new Map<Id<"items">, { helped: number; neutral: number; hurt: number }>();
    for (const l of logs) {
      if (!l.itemId) continue;
      const c = byItem.get(l.itemId) ?? { helped: 0, neutral: 0, hurt: 0 };
      c[l.outcome]++;
      byItem.set(l.itemId, c);
    }
    // Warning signs logged: date and which signs, never the note itself.
    const warnings = logs
      .map((l) => ({ at: l.createdAt, ...(l.warning ?? scanWarningSigns(l.note)) }))
      .filter((w) => w.level)
      .slice(0, 20)
      .map((w) => ({ at: w.at, level: w.level!, signs: w.signs }));

    const patterns = [];
    for (const [itemId, c] of byItem) {
      const total = c.helped + c.neutral + c.hurt;
      if (total < 2) continue;
      const item = await ctx.db.get("items", itemId);
      patterns.push({ item: item?.canonicalName ?? "item", ...c, total });
    }
    patterns.sort((a, b) => b.total - a.total);

    // Meds with the same deterministic review as the home screen.
    const medRows = (await medReviewRows(ctx, me)).map((r) => ({
      ...r,
      labelChecked: r.state !== "cant-tell",
      // The sheet prints one source per flag: the first guideline, else the label.
      flags: r.flags.map((f) => ({
        text: f.text,
        citation: (f.citations.find((c) => c.key.startsWith("G:")) ?? f.citations[0])?.key ?? null,
      })),
    }));

    const view = (q: (typeof questions)[number]) => ({
      _id: q._id,
      text: q.text,
      itemName: q.context.itemName ?? null,
      status: statusOf(q),
    });
    return {
      anatomyText: describeAnatomy(me.anatomy),
      role: me.role,
      caresFor: me.caresFor ?? null,
      language: me.language,
      // Open and asked questions both still need an answer at the appointment.
      open: questions.filter((q) => statusOf(q) !== "answered").map(view),
      answered: questions
        .filter((q) => statusOf(q) === "answered")
        .map((q) => {
          const a = answerFor.get(q._id);
          return {
            ...view(q),
            answer: a
              ? {
                  _id: a._id,
                  professionalType: a.professionalType,
                  text: a.answerText,
                  resultingChange: a.resultingChange ?? null,
                  status: a.pooled === null ? "checking" : a.pooled ? "shared" : "private",
                }
              : null,
          };
        }),
      patterns,
      warnings,
      meds: medRows,
    };
  },
});
