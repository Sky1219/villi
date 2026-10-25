"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { AnatomyBadge } from "@/components/AnatomyBadge";

type Summary = FunctionReturnType<typeof api.impact.summary>;

function DemoCount({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">+{n} demo data</span>;
}

function ByAnatomy({ rows }: { rows: { anatomyKey: string; label: string; n: number }[] }) {
  if (!rows.length) return null;
  return (
    <ul className="mt-1 space-y-1">
      {rows.map((a) => (
        <li key={a.anatomyKey} className="flex items-center gap-2 text-sm">
          <AnatomyBadge anatomyKey={a.anatomyKey} />
          <span className="min-w-0 flex-1">{a.label}</span>
          <span className="font-bold">{a.n}</span>
        </li>
      ))}
    </ul>
  );
}

// The headline: real use only, each stage a subset of the one before.
function Funnel({ d }: { d: Summary }) {
  const empty = d.funnel[0].total === 0;
  return (
    <section className="space-y-2">
      <h2 className="font-bold">From a flag to a change (real use only)</h2>
      {empty && (
        <p className="rounded-2xl border border-border bg-surface-2 p-4 text-sm">
          No real answers logged yet. Demo profiles don&apos;t count here; this weekend, real use is the builder&apos;s own
          checks.
        </p>
      )}
      <ol className="space-y-2">
        {d.funnel.map((s) => (
          <li key={s.key} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-bold text-muted">{s.label}</p>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold">{s.total}</span>
              {s.pctOfPrevious !== null && <span className="text-sm text-muted">{s.pctOfPrevious}% of the step before</span>}
            </p>
            <p className="text-xs text-muted">{s.help}</p>
            {s.split && (
              <p className="mt-1 text-sm">
                {s.split.self} self-reported · {s.split.teamLink} recorded through a care-team link
              </p>
            )}
            {s.outcomes && (
              <p className="mt-1 text-sm">
                {s.outcomes.helped} helped · {s.outcomes.neutral} no change · {s.outcomes.hurt} worse
              </p>
            )}
            <ByAnatomy rows={s.byAnatomy} />
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        Care-team-link answers are recorded by whoever holds the link; Villi doesn&apos;t verify who they are.
      </p>
    </section>
  );
}

// The problem Villi exists for: people are rarely told. Each real flag asks "Did you know this already?".
function News({ d }: { d: Summary }) {
  const n = d.news;
  const pct = n.answered ? Math.round((n.newToThem / n.answered) * 100) : null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-bold">Was the flag news?</h2>
      {n.answered === 0 ? (
        <p className="mt-1 text-sm">
          No answers yet. Every real flag asks &ldquo;Did you know this already?&rdquo;, and the answers land here.
        </p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold">{n.newToThem}</span>
            <span className="text-sm text-muted">
              of {n.answered} flags were new to the person ({pct}%)
            </span>
          </p>
          <ul className="mt-1 space-y-1">
            {n.byAnatomy.map((a) => (
              <li key={a.anatomyKey} className="flex items-center gap-2 text-sm">
                <AnatomyBadge anatomyKey={a.anatomyKey} />
                <span className="min-w-0 flex-1">{a.label}</span>
                <span className="font-bold">
                  {a.newToThem} of {a.answered}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-1 text-xs text-muted">
        Real use only. From the &ldquo;Did you know this already?&rdquo; tap on flagged checks and flagged medicines in the list
        review. Self-reported.
      </p>
    </section>
  );
}

function Review({ d }: { d: Summary }) {
  const rows = d.review.byAnatomy.filter((a) => a.reviewed > 0);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-bold">Medicine list review</h2>
      <p className="text-sm">
        <span className="text-3xl font-bold">{d.review.reviewed}</span> medicines reviewed,{" "}
        <span className="font-bold">{d.review.flagged}</span> flagged to discuss
      </p>
      <p className="text-xs text-muted">Real profiles only. A medicine counts once its FDA label has been read.</p>
      {rows.length > 0 && (
        <ul className="mt-1 space-y-1">
          {rows.map((a) => (
            <li key={a.anatomyKey} className="flex items-center gap-2 text-sm">
              <AnatomyBadge anatomyKey={a.anatomyKey} />
              <span className="min-w-0 flex-1">{a.label}</span>
              <span className="font-bold">
                {a.flagged} of {a.reviewed}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value, demo = 0 }: { label: string; value: number; demo?: number }) {
  return (
    <li className="flex items-baseline justify-between gap-2 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-bold">{value}</span>
        <DemoCount n={demo} />
      </span>
    </li>
  );
}

function Safety({ d }: { d: Summary }) {
  const s = d.safety;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-bold">Safety record</h2>
      <p className="mb-2 text-xs text-muted">
        Real use only, except where demo data is marked. Every draft passes a code check and a second review before anyone
        sees it; tightening a draft is that review doing its job.
      </p>
      <h3 className="mt-2 text-sm font-bold text-muted">Answers</h3>
      <ul className="space-y-1">
        <Row label="Shown, after both checks" value={s.answers.approved + s.answers.edited} />
        <Row label="Of those, wording tightened to stay within the sources" value={s.answers.edited} />
        <Row label="Held back by the safety check (never shown)" value={s.answers.blocked} />
        <Row label="Didn't finish (busy service or timeout), with a Try again" value={s.answers.failed} />
        <Row label="Drafts the code check trimmed" value={s.codeChecks.answersTouched} />
        <Row label="Claims or swaps it removed" value={s.codeChecks.fixes} />
      </ul>
      <h3 className="mt-3 text-sm font-bold text-muted">Shared or kept private after screening</h3>
      <ul className="space-y-1">
        <Row label="Logs shared (counts only)" value={s.logs.shared} demo={s.logs.demoShared} />
        <Row label="Logs kept private" value={s.logs.private} />
        <Row label="Logs still being checked" value={s.logs.checking} />
        <Row label="Swaps shared" value={s.swaps.shared} demo={s.swaps.demoShared} />
        <Row label="Swaps kept private" value={s.swaps.private} />
      </ul>
      <h3 className="mt-3 text-sm font-bold text-muted">Warning-sign cards shown</h3>
      <ul className="space-y-1">
        <Row label="Emergency" value={s.warningCards.emergency} />
        <Row label="Dehydration signs" value={s.warningCards.dehydration} />
        <Row label="After a worse drink" value={s.warningCards.softAfterWorseDrink} />
      </ul>
      <h3 className="mt-3 text-sm font-bold text-muted">&ldquo;Something&apos;s wrong with this answer&rdquo;</h3>
      <ul className="space-y-1">
        <Row label="Wrong medicine identified" value={s.problemReports.wrong_item} />
        <Row label="A claim isn't supported by its source" value={s.problemReports.unsupported_claim} />
        <Row label="Confusing" value={s.problemReports.confusing} />
        <Row label="Other" value={s.problemReports.other} />
      </ul>
    </section>
  );
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
          Live, split by anatomy.
        </p>
      </header>

      <News d={d} />
      <Funnel d={d} />
      <Review d={d} />
      <Safety d={d} />

      <section className="space-y-3">
        <h2 className="font-bold">All activity, including demo data</h2>
        <p className="text-xs text-muted">
          Big numbers are real use; the seeded demo community and demo profiles are counted separately. These count every
          logged answer, not only those that began with a Villi flag, so some can be larger than the steps above.
        </p>
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
      </section>

      <p className="text-xs text-muted">
        Self-reported by the people using Villi, or recorded through a care-team link. Outcomes are what they logged their
        care team decided, not a trial.
      </p>
    </main>
  );
}

export default function ImpactPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Impact anonId={anonId} />;
}
