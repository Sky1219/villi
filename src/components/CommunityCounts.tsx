"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AnatomyBadge } from "@/components/AnatomyBadge";

// Below this many reports a cell is shown as "too few to say", not a percentage.
const MIN_N = 5;

function Bar({ helped, neutral, hurt }: { helped: number; neutral: number; hurt: number }) {
  const total = helped + neutral + hurt;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <span className="bg-ok" style={{ width: pct(helped) }} />
      <span className="bg-removed" style={{ width: pct(neutral) }} />
      <span className="bg-flag" style={{ width: pct(hurt) }} />
    </div>
  );
}

export function CommunityCounts({ anonId, itemId }: { anonId: string; itemId: Id<"items"> }) {
  const c = useQuery(api.community.liveCounts, { anonId, itemId });
  if (!c) return null;
  const rows = [...c.byAnatomy].sort((a, b) => Number(b.anatomyKey === c.anatomyKey) - Number(a.anatomyKey === c.anatomyKey));

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-live="polite">
      <h2 className="mb-1 flex flex-wrap items-center gap-2 font-bold">
        What people logged for {c.canonicalName}
        {c.includesSynthetic && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">demo data</span>}
      </h2>
      <p className="mb-3 text-xs text-muted">Self-reported, not a trial. Evidence about tolerance, not a recommendation. Updates live.</p>
      {rows.length === 0 && <p className="text-sm text-muted">No one has logged this yet. Your log would be the first.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.anatomyKey} className={`flex items-center gap-3 ${r.anatomyKey === c.anatomyKey ? "" : "opacity-80"}`}>
            <AnatomyBadge anatomyKey={r.anatomyKey} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {r.label}
                {r.anatomyKey === c.anatomyKey && <span className="ml-1 font-normal text-accent">(like you)</span>}
              </p>
              {r.total < MIN_N ? (
                <p className="text-sm text-muted">Too few reports to say ({r.total})</p>
              ) : (
                <>
                  <Bar helped={r.helped} neutral={r.neutral} hurt={r.hurt} />
                  <p className="mt-1 text-sm">
                    {r.helped} helped · {r.neutral} no change · {r.hurt} hurt <span className="text-muted">of {r.total}</span>
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
