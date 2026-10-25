import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireProfile } from "./profiles";
import { statusOf } from "./questions";
import { describeAnatomy } from "./lib/anatomy";
import { reviewQuestion } from "./lib/medReview";
import { medReviewRows } from "./meds";
import { scanWarningSigns } from "./lib/warningSigns";

// Everything the appointment sheet shows, in one reactive query.
export const get = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => sheetFor(ctx, await requireProfile(ctx, args.anonId)),
});

// Shared by the patient's sheet and the read-only care-team link view.
export async function sheetFor(ctx: QueryCtx, me: Doc<"profiles">) {
  {

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
      // The pharmacist review request prints both sources of every flag: the label
      // sentence and the guideline, plus one formulation question per flagged medicine.
      requestFlags: r.flags.map((f) => {
        const label = f.citations.find((c) => c.key.startsWith("L:"));
        // The first guideline short enough to print whole, so a line is never cut mid-claim.
        const guidelines = f.citations.filter((c) => c.key.startsWith("G:"));
        const guideline = guidelines.find((c) => c.text.length <= 220) ?? guidelines[0];
        return {
          text: f.text,
          label: label ? { key: label.key, source: label.label, text: label.text } : null,
          guideline: guideline
            ? { key: guideline.key, source: guideline.label, section: guideline.section ?? null, text: guideline.text }
            : null,
        };
      }),
      // The anatomy is in the request header, so the question says "this anatomy".
      question: r.state === "flagged" ? reviewQuestion(r.name, "this anatomy") : null,
    }));

    const view = (q: (typeof questions)[number]) => ({
      _id: q._id,
      text: q.text,
      itemName: q.context.itemName ?? null,
      status: statusOf(q),
      // Seeded demo questions (the demo follow-up) are badged wherever they show.
      synthetic: q.synthetic,
    });
    return {
      // A demo profile (seeded, or started from "Demo: the builder's dad"): printouts say so.
      demo: me.synthetic || me.demoClone === true,
      anatomyText: describeAnatomy(me.anatomy),
      anatomyConfirmed: me.anatomyConfirmed !== false,
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
            newFormName: q.newFormName ?? null,
            afterChangeOutcome: q.afterChangeOutcome ?? null,
            followUpDue: !!q.followUpDue,
            answer: a
              ? {
                  _id: a._id,
                  professionalType: a.professionalType,
                  text: a.answerText,
                  resultingChange: a.resultingChange ?? null,
                  status: a.pooled === null ? "checking" : a.pooled ? "shared" : "private",
                  // "team_link" when the person holding the care-team link recorded it.
                  source: a.source ?? "self",
                }
              : null,
          };
        }),
      patterns,
      warnings,
      meds: medRows,
    };
  }
}
