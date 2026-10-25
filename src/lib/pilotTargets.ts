// The pilot thresholds from README "Measuring impact": our own targets, set before any
// pilot data, not from a study. Each one is read off the live, real-use-only numbers.
type Stage = { key: string; total: number; outcomes: { helped: number; neutral: number; hurt: number } | null };

export type PilotTarget = { target: string; now: string | null };

// With so few answers, the count matters as much as the percentage.
const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}% (${n} of ${of})`;

export function pilotTarget(key: string, funnel: Stage[]): PilotTarget | null {
  const total = (k: string) => funnel.find((s) => s.key === k)?.total ?? 0;
  if (key === "asked") {
    const saved = total("saved");
    return { target: "at least 40% of saved questions get asked", now: saved ? pct(total("asked"), saved) : null };
  }
  if (key === "changed") {
    const asked = total("asked");
    return { target: "at least 15% of asked questions lead to a change", now: asked ? pct(total("changed"), asked) : null };
  }
  if (key === "outcome") {
    const o = funnel.find((s) => s.key === "outcome")?.outcomes;
    const n = o ? o.helped + o.neutral + o.hurt : 0;
    return { target: "more “helped” than “worse”, and every “worse” reviewed", now: o && n ? `${o.helped} helped, ${o.hurt} worse` : null };
  }
  return null;
}

export function newsTarget(newToThem: number, answered: number): PilotTarget {
  return { target: "at least 50% of answered flags are new to the person", now: answered ? pct(newToThem, answered) : null };
}
