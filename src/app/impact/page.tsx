"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { AnatomyBadge } from "@/components/AnatomyBadge";

function DemoCount({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">+{n} demo data</span>;
}

function Impact({ anonId }: { anonId: string }) {
  const d = useQuery(api.impact.summary, { anonId });
  if (!d) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return (
    <main className="space-y-5 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Is Villi working?</h1>
        <p className="text-sm text-muted">
          Each question Villi writes is meant to reach a care team and change something. These counts follow it there.
          Live, split by anatomy. Big numbers are real use; demo data is counted separately.
        </p>
      </header>

      <ul className="space-y-3">
        {d.metrics.map((m) => (
          <li key={m.key} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-bold text-muted">{m.label}</p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-3xl font-bold">{m.real}</span>
              <DemoCount n={m.demo} />
            </p>
            <p className="mb-2 text-xs text-muted">{m.help}</p>
            <ul className="space-y-1">
              {m.byAnatomy
                .filter((a) => a.real + a.demo > 0)
                .map((a) => (
                  <li key={a.anatomyKey} className="flex items-center gap-2 text-sm">
                    <AnatomyBadge anatomyKey={a.anatomyKey} />
                    <span className="min-w-0 flex-1">{a.label}</span>
                    <span className="font-bold">{a.real}</span>
                    {a.demo > 0 && <span className="text-muted">+{a.demo} demo</span>}
                  </li>
                ))}
            </ul>
          </li>
        ))}
        <li className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold text-muted">Answers rated useful</p>
          <p className="text-3xl font-bold">
            {d.useful.yes} <span className="text-base font-normal text-muted">of {d.useful.rated} rated</span>
          </p>
          <p className="text-xs text-muted">From the &ldquo;Was this useful?&rdquo; tap on each answer.</p>
        </li>
      </ul>

      <p className="text-xs text-muted">
        Self-reported by the people using Villi. Outcomes are what they logged their care team decided, not a trial.
      </p>
    </main>
  );
}

export default function ImpactPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Impact anonId={anonId} />;
}
