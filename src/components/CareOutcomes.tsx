"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { tooFewToSay } from "@convex/lib/careFor";
import { AnatomyBadge } from "@/components/AnatomyBadge";

const DEMO = <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">demo data</span>;
const LINE = "Reported by other families from their own care teams. What a care team decides depends on the person.";

type Cell = { total: number; formulation_changed: number; dose_monitored: number; no_change: number; pending: number };

function CellText({ c }: { c: Cell }) {
  if (tooFewToSay(c.total)) return <p className="text-sm text-muted">Too few reports to say ({c.total})</p>;
  return (
    <p className="text-sm">
      {c.formulation_changed} form changed · {c.dose_monitored} monitoring started · {c.no_change} no change · {c.pending} not decided{" "}
      <span className="text-muted">of {c.total}</span>
    </p>
  );
}

// On the answer page, with the community card.
export function CareOutcomes({ anonId, itemId }: { anonId: string; itemId: Id<"items"> }) {
  const d = useQuery(api.community.careOutcomesFor, { anonId, itemId });
  const profile = useQuery(api.profiles.me, { anonId });
  if (!d || d.byAnatomy.length === 0) return null;
  const like = profile?.role === "caregiver" ? "(like them)" : "(like you)";
  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-live="polite">
      <h2 className="mb-1 flex flex-wrap items-center gap-2 font-bold">
        What care teams changed for {d.canonicalName}
        {d.includesSynthetic && DEMO}
      </h2>
      <p className="mb-3 text-xs text-muted">{LINE} People who asked about it, by anatomy. Evidence, not a recommendation.</p>
      <ul className="space-y-3">
        {d.byAnatomy.map((c) => (
          <li key={c.anatomyKey} className="flex items-center gap-3">
            <AnatomyBadge anatomyKey={c.anatomyKey} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {c.label}
                {c.anatomyKey === d.matchingKey && <span className="ml-1 font-normal text-accent">{like}</span>}
              </p>
              <CellText c={c} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Community page, care-team tab: every item with outcomes for the chosen anatomy.
export function CareOutcomesList({ anonId, filter }: { anonId: string; filter: string }) {
  const rows = useQuery(api.community.careOutcomesList, { anonId, anatomy: filter });
  if (!rows || rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="font-bold">What care teams changed</h2>
      <p className="text-sm text-muted">{LINE}</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={`${r.item}-${r.anatomyKey}`} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <AnatomyBadge anatomyKey={r.anatomyKey} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {r.item}
                {r.synthetic && DEMO}
              </p>
              <p className="text-xs text-muted">People with {r.label} who asked about it</p>
              <CellText c={r} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
