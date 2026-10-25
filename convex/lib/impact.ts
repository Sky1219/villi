// "Is Villi working?": counts of the ASK loop, split by anatomy and real vs demo.
// Pure, so the tally is unit-testable without a database.
import { ANATOMY_KEYS, ANATOMY_LABELS, type AnatomyKey } from "./anatomy";

export const IMPACT_METRICS = [
  { key: "flagsRaised", label: "Checks flagged to discuss", help: "Full checks that ended in \"Flag to discuss\". Medicine list review flags are counted above." },
  { key: "questionsAsked", label: "Questions asked", help: "Taken to a pharmacist, dietitian or doctor" },
  { key: "answersLogged", label: "Answers logged", help: "What the care team said, written down" },
  { key: "formulationChanged", label: "Formulation changes", help: "The team changed the form of a medicine, whether or not the question began with a Villi flag" },
  { key: "monitored", label: "Monitoring started", help: "Levels, readings or the effect being watched" },
] as const;
export type ImpactMetric = (typeof IMPACT_METRICS)[number]["key"];

export type ImpactEvent = { metric: ImpactMetric; anatomyKey: string; synthetic: boolean };

type Cell = { real: number; demo: number };

export function tallyImpact(events: ImpactEvent[]) {
  return IMPACT_METRICS.map((m) => {
    const byKey = new Map<string, Cell>(ANATOMY_KEYS.map((k) => [k, { real: 0, demo: 0 }]));
    const total: Cell = { real: 0, demo: 0 };
    for (const e of events) {
      if (e.metric !== m.key) continue;
      const cell = byKey.get(e.anatomyKey);
      if (!cell) continue;
      cell[e.synthetic ? "demo" : "real"]++;
      total[e.synthetic ? "demo" : "real"]++;
    }
    return {
      ...m,
      ...total,
      byAnatomy: ANATOMY_KEYS.map((k) => ({ anatomyKey: k, label: ANATOMY_LABELS[k as AnatomyKey], ...byKey.get(k)! })),
    };
  });
}

// ---- The funnel at the top of /impact: real use only, by anatomy.
// Each stage is a subset of the one before, so "% of previous" never exceeds 100.

export type FunnelQuestion = {
  anatomyKey: string;
  asked: boolean;
  answered: "self" | "team_link" | null;
  changed: boolean;
  outcome: "helped" | "neutral" | "hurt" | null;
};

export const FUNNEL_STAGES = [
  { key: "flagged", label: "Flags raised", help: "Checks that ended in \"Flag to discuss\", and flagged medicines in the list review" },
  { key: "saved", label: "Question saved", help: "A flag's question added to the appointment sheet" },
  { key: "asked", label: "Asked", help: "Taken to a pharmacist, dietitian or doctor" },
  { key: "answered", label: "Answer logged", help: "What the care team said, written down" },
  { key: "changed", label: "Something changed", help: "Of those answers: the form changed, or monitoring started" },
  { key: "outcome", label: "Two-week outcome", help: "How it went two weeks after the change" },
] as const;

export function tallyFunnel(flags: { anatomyKey: string }[], questions: FunnelQuestion[]) {
  const inStage: Record<(typeof FUNNEL_STAGES)[number]["key"], { anatomyKey: string }[]> = {
    flagged: flags,
    saved: questions,
    asked: questions.filter((q) => q.asked),
    answered: questions.filter((q) => q.asked && q.answered),
    changed: questions.filter((q) => q.asked && q.answered && q.changed),
    outcome: questions.filter((q) => q.asked && q.answered && q.changed && q.outcome),
  };
  let previous: number | null = null;
  return FUNNEL_STAGES.map((s) => {
    const rows = inStage[s.key];
    const total = rows.length;
    const pctOfPrevious = previous === null || previous === 0 ? null : Math.round((total / previous) * 100);
    previous = total;
    const answered = s.key === "answered" ? questions.filter((q) => q.asked && q.answered) : [];
    const outcomes = s.key === "outcome" ? inStage.outcome as FunnelQuestion[] : [];
    return {
      ...s,
      total,
      pctOfPrevious,
      byAnatomy: ANATOMY_KEYS.map((k) => ({ anatomyKey: k, label: ANATOMY_LABELS[k as AnatomyKey], n: rows.filter((r) => r.anatomyKey === k).length })).filter(
        (a) => a.n > 0,
      ),
      // Answers recorded through the care-team link are reported apart from self-reported ones.
      split:
        s.key === "answered"
          ? { self: answered.filter((q) => q.answered === "self").length, teamLink: answered.filter((q) => q.answered === "team_link").length }
          : null,
      outcomes:
        s.key === "outcome"
          ? { helped: outcomes.filter((q) => q.outcome === "helped").length, neutral: outcomes.filter((q) => q.outcome === "neutral").length, hurt: outcomes.filter((q) => q.outcome === "hurt").length }
          : null,
    };
  });
}
