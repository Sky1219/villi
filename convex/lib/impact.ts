// "Is Villi working?": counts of the ASK loop, split by anatomy and real vs demo.
// Pure, so the tally is unit-testable without a database.
import { ANATOMY_KEYS, ANATOMY_LABELS, type AnatomyKey } from "./anatomy";

export const IMPACT_METRICS = [
  { key: "flagsRaised", label: "Flags raised", help: "Checks that ended in \"Flag to discuss\"" },
  { key: "questionsAsked", label: "Questions asked", help: "Taken to a pharmacist, dietitian or doctor" },
  { key: "answersLogged", label: "Answers logged", help: "What the care team said, written down" },
  { key: "formulationChanged", label: "Formulation changes", help: "The team changed the form of a medicine" },
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
