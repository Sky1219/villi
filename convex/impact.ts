import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireProfile } from "./profiles";
import { statusOf } from "./questions";
import { tallyFunnel, tallyImpact, type FunnelQuestion, type ImpactEvent } from "./lib/impact";
import { ANATOMY_KEYS, ANATOMY_LABELS } from "./lib/anatomy";
import { medReviewRows } from "./meds";
import { cardFor, scanWarningSigns } from "./lib/warningSigns";

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
    // Seeded demo rows, and anything written by a device trying /demo, count as demo data.
    const isDemo = (p: Doc<"profiles"> | null) => !!p && (p.synthetic || p.demoClone === true);

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
        events.push({ metric: "flagsRaised", anatomyKey: p.anatomyKey, synthetic: isDemo(p) });
      }
      if (a.useful !== undefined) {
        rated++;
        if (a.useful) useful++;
      }
    }

    for (const q of await ctx.db.query("questions").take(LIMIT)) {
      if (statusOf(q) === "open") continue;
      const p = await profileOf(q.profileId);
      if (p) events.push({ metric: "questionsAsked", anatomyKey: p.anatomyKey, synthetic: q.synthetic || isDemo(p) });
    }

    for (const c of await ctx.db.query("care_team_answers").take(LIMIT)) {
      const base = { anatomyKey: c.anatomyKey, synthetic: c.synthetic || isDemo(await profileOf(c.profileId)) };
      events.push({ metric: "answersLogged", ...base });
      if (c.resultingChange === "formulation_changed") events.push({ metric: "formulationChanged", ...base });
      if (c.resultingChange === "dose_monitored") events.push({ metric: "monitored", ...base });
    }

    // ---- Real use only from here on: no synthetic rows, no demo clones, no clinician profiles.
    const isReal = (p: Doc<"profiles"> | null): p is Doc<"profiles"> => !!p && !isDemo(p) && p.role !== "clinician";

    // Funnel stage 1a: flagged checks.
    const flags: { anatomyKey: string }[] = [];
    const flaggedAnswers = new Set<Id<"answers">>();
    for (const a of answers) {
      const p = await profileOf(a.profileId);
      if (a.kind !== "scan" || !isReal(p)) continue;
      if ((a.final as { state?: string } | undefined)?.state === "flagged") {
        flags.push({ anatomyKey: p.anatomyKey });
        flaggedAnswers.add(a._id);
      }
    }

    // Medicine list review (stage 1b), from each real profile's medicines.
    const review = { reviewed: 0, flagged: 0, byAnatomy: ANATOMY_KEYS.map((k) => ({ anatomyKey: k, label: ANATOMY_LABELS[k], reviewed: 0, flagged: 0 })) };
    const reviewedProfiles = new Set<Id<"profiles">>();
    for (const m of await ctx.db.query("meds").take(LIMIT)) {
      if (reviewedProfiles.has(m.profileId)) continue;
      reviewedProfiles.add(m.profileId);
      const p = await profileOf(m.profileId);
      if (!isReal(p)) continue;
      const cell = review.byAnatomy.find((b) => b.anatomyKey === p.anatomyKey);
      for (const r of await medReviewRows(ctx, p)) {
        if (r.state === "cant-tell") continue;
        review.reviewed++;
        if (cell) cell.reviewed++;
        if (r.state === "flagged") {
          review.flagged++;
          if (cell) cell.flagged++;
          flags.push({ anatomyKey: p.anatomyKey });
        }
      }
    }

    // Stages 2-6: questions that came from a flag, followed through the loop.
    const careByQuestion = new Map<Id<"questions">, Doc<"care_team_answers">>();
    for (const c of await ctx.db.query("care_team_answers").take(LIMIT)) if (c.questionId && !c.synthetic && !isDemo(await profileOf(c.profileId))) careByQuestion.set(c.questionId, c);
    const chain: FunnelQuestion[] = [];
    for (const q of await ctx.db.query("questions").take(LIMIT)) {
      if (q.synthetic) continue;
      const fromFlag = (q.context.answerId && flaggedAnswers.has(q.context.answerId)) || q.context.fromReview;
      if (!fromFlag) continue;
      const p = await profileOf(q.profileId);
      if (!isReal(p)) continue;
      const status = statusOf(q);
      const care = careByQuestion.get(q._id);
      chain.push({
        anatomyKey: p.anatomyKey,
        asked: status !== "open",
        answered: status === "answered" && care ? (care.source ?? "self") : null,
        changed: care?.resultingChange === "formulation_changed" || care?.resultingChange === "dose_monitored",
        outcome: q.afterChangeOutcome ?? null,
      });
    }

    // ---- Safety record, from real writes. Bounded scans like the rest.
    const safety = {
      answers: { approved: 0, edited: 0, blocked: 0, failed: 0 },
      codeChecks: { answersTouched: 0, fixes: 0 },
      logs: { shared: 0, private: 0, checking: 0, demoShared: 0 },
      swaps: { shared: 0, private: 0, checking: 0, demoShared: 0 },
      warningCards: { emergency: 0, dehydration: 0, softAfterWorseDrink: 0 },
      problemReports: { wrong_item: 0, unsupported_claim: 0, confusing: 0, other: 0 },
    };
    const reviewed: Doc<"answers">[] = [];
    for (const status of ["final", "blocked", "failed"] as const) {
      const rows = status === "final" ? answers : await ctx.db.query("answers").withIndex("by_status", (q) => q.eq("status", status)).take(LIMIT);
      for (const a of rows) {
        if (!isReal(await profileOf(a.profileId))) continue;
        if (status === "final") {
          safety.answers[a.reviewSummary?.edited ? "edited" : "approved"]++;
          if (a.problemReport) safety.problemReports[a.problemReport]++;
        } else safety.answers[status]++;
        if (status !== "failed") reviewed.push(a);
      }
    }
    for (const a of reviewed.slice(0, 500)) {
      const r = await ctx.db.query("answer_reviews").withIndex("by_answerId", (q) => q.eq("answerId", a._id)).first();
      if (r && r.lint.length) {
        safety.codeChecks.answersTouched++;
        safety.codeChecks.fixes += r.lint.length;
      }
    }
    const categories = new Map<Id<"items">, string | null>();
    for (const l of await ctx.db.query("log_entries").take(LIMIT)) {
      const state = l.pooled === null ? "checking" : l.pooled ? "shared" : "private";
      if (l.synthetic || isDemo(await profileOf(l.profileId))) {
        if (state === "shared") safety.logs.demoShared++;
        continue;
      }
      safety.logs[state]++;
      if (l.itemId && !categories.has(l.itemId)) categories.set(l.itemId, (await ctx.db.get("items", l.itemId))?.category ?? null);
      const card = cardFor(l.warning ?? scanWarningSigns(l.note), l.outcome, l.itemId ? (categories.get(l.itemId) ?? null) : null);
      if (card === "emergency" || card === "dehydration") safety.warningCards[card]++;
      if (card === "drink-worse") safety.warningCards.softAfterWorseDrink++;
    }
    for (const s of await ctx.db.query("swaps").take(LIMIT)) {
      const state = s.pooled === null ? "checking" : s.pooled ? "shared" : "private";
      if (s.synthetic || isDemo(await profileOf(s.profileId))) {
        if (state === "shared") safety.swaps.demoShared++;
        continue;
      }
      safety.swaps[state]++;
    }

    return {
      metrics: tallyImpact(events),
      useful: { yes: useful, rated },
      funnel: tallyFunnel(flags, chain),
      review,
      safety,
    };
  },
});
