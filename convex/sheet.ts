import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireProfile } from "./profiles";
import { computeFlags, labelKeyFor, releaseFormOf, type ReleaseForm } from "./fda";
import { describeAnatomy, scopeTagsFor } from "./lib/anatomy";
import corpus from "../data/guidelines.json";

const SCOPES: Record<string, string[]> = Object.fromEntries(corpus.chunks.map((c) => [`${c.sourceId}#${c.locator}`, c.anatomyScope]));

// Everything the appointment sheet shows, in one reactive query.
export const get = query({
  args: { anonId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx, args.anonId);
    const tags = scopeTagsFor(me.anatomy);
    const cite = (chunkId: string) => ((SCOPES[chunkId] ?? []).some((s) => tags.includes(s)) ? `G:${chunkId}` : null);

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
    const patterns = [];
    for (const [itemId, c] of byItem) {
      const total = c.helped + c.neutral + c.hurt;
      if (total < 2) continue;
      const item = await ctx.db.get("items", itemId);
      patterns.push({ item: item?.canonicalName ?? "item", ...c, total });
    }
    patterns.sort((a, b) => b.total - a.total);

    // Meds with deterministic flags from the cached FDA label.
    const meds = await ctx.db
      .query("meds")
      .withIndex("by_profileId", (q) => q.eq("profileId", me._id))
      .take(30);
    const medRows = [];
    for (const m of meds) {
      const cached = await ctx.db
        .query("fda_label_cache")
        .withIndex("by_queryKey", (q) => q.eq("queryKey", m.fdaLabelKey ?? labelKeyFor(m.name)))
        .unique();
      const dosageForm = cached?.dosageForms[0] ?? m.dosageForm ?? null;
      const releaseForm: ReleaseForm = dosageForm ? releaseFormOf(dosageForm) : "unknown";
      const flags: { text: string; citation: string | null }[] = [];
      if (cached?.found) {
        const { release_form: _rf, other_forms: _of, ...sections } = cached.sections;
        for (const f of computeFlags(sections, releaseForm)) {
          if (f.flag === "extended-release" || f.flag === "delayed-release") {
            flags.push({ text: `${f.flag} form`, citation: cite("aga-sbs#medications-release-forms") });
          } else if (f.flag === "sugar-alcohol") {
            flags.push({ text: `contains ${f.evidence}`, citation: cite("pg139#sugar-alcohols") });
          } else if (f.flag === "swallow-whole") {
            flags.push({ text: "label says to swallow whole", citation: "L:dosage_and_administration" });
          }
        }
      }
      medRows.push({
        _id: m._id,
        name: m.name,
        dosageForm,
        labelChecked: !!cached?.found,
        labelSource: cached?.found ? `${cached.brandName ?? cached.genericName ?? ""} (${cached.manufacturer ?? "?"}, ${cached.effectiveTime ?? "?"})` : null,
        flags,
      });
    }

    return {
      anatomyText: describeAnatomy(me.anatomy),
      role: me.role,
      language: me.language,
      open: questions.filter((q) => !q.resolved).map((q) => ({ _id: q._id, text: q.text, itemName: q.context.itemName ?? null })),
      answered: questions
        .filter((q) => q.resolved)
        .map((q) => {
          const a = answerFor.get(q._id);
          return {
            _id: q._id,
            text: q.text,
            itemName: q.context.itemName ?? null,
            answer: a ? { professionalType: a.professionalType, text: a.answerText, status: a.pooled === null ? "checking" : a.pooled ? "shared" : "private" } : null,
          };
        }),
      patterns,
      meds: medRows,
    };
  },
});
