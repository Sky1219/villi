"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { ANATOMY_KEYS, ANATOMY_LABELS } from "@convex/lib/anatomy";
import { useAnonId } from "@/lib/anon";
import { friendlyError } from "@/lib/errors";
import { citationLabel, humanizeCitations, sectionOf } from "@/lib/citations";
import { AnatomyBadge } from "@/components/AnatomyBadge";
import { CareOutcomesList } from "@/components/CareOutcomes";
import { Loading } from "@/components/Loading";

const FILTERS = [{ key: "mine", label: "Like me" }, { key: "all", label: "Everyone" }, ...ANATOMY_KEYS.map((k) => ({ key: k, label: ANATOMY_LABELS[k] }))];

function Badges({ synthetic }: { synthetic: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {synthetic && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">demo data</span>}
    </span>
  );
}

function Cites({ citations }: { citations: string[] }) {
  if (!citations.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {citations.map((c) => {
        const [kind, ...rest] = c.split(":");
        return (
          <span key={c} title={c} className="rounded-full bg-info-soft px-2.5 py-1 text-xs font-bold text-info">
            {citationLabel(kind, rest.join(":"))}
            {kind === "G" && sectionOf(rest.join(":")) ? ` · ${sectionOf(rest.join(":"))}` : ""}
          </span>
        );
      })}
    </span>
  );
}

function SwapForm({ anonId }: { anonId: string }) {
  const submit = useAction(api.swaps.submit);
  const [insteadOf, setInsteadOf] = useState("");
  const [use, setUse] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "min-h-12 w-full rounded-xl border border-border bg-background px-3";
  return (
    <form
      className="space-y-2 rounded-2xl border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await submit({ anonId, insteadOf, use, note });
          setInsteadOf("");
          setUse("");
          setNote("");
        } catch (err) {
          setError(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        Instead of
        <input value={insteadOf} onChange={(e) => setInsteadOf(e.target.value)} placeholder="e.g. soda" className={field} required />
      </label>
      <label className="block text-sm">
        I have
        <input value={use} onChange={(e) => setUse(e.target.value)} placeholder="e.g. ORS over ice" className={field} required />
      </label>
      <label className="block text-sm">
        A short note (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} className={field} />
      </label>
      <p className="text-xs text-muted">Checked against the guidelines for your anatomy and screened before anyone sees it. No names.</p>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-accent px-4 font-bold text-accent-ink disabled:opacity-60">
        {busy ? "Checking…" : "Share swap"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </form>
  );
}

function Swaps({ anonId, filter }: { anonId: string; filter: string }) {
  const data = useQuery(api.swaps.list, { anonId, anatomy: filter });
  const upvote = useMutation(api.swaps.upvote);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.catch((e) => setError(friendlyError(e)));
  if (!data) return <Loading inline />;
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center rounded-xl border-2 border-accent font-bold text-accent group-open:mb-3">
          Share a swap that worked for you
        </summary>
        <SwapForm anonId={anonId} />
      </details>
      {data.mine.filter((s) => s.status !== "shared").length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Your swaps</h2>
          {data.mine
            .filter((s) => s.status !== "shared")
            .map((s) => (
              <div key={s._id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
                <p className="font-bold">
                  Instead of {s.insteadOf} → {s.use}
                </p>
                <p className="text-muted">{s.status === "checking" ? "Checking against the guidelines…" : humanizeCitations(s.nudge ?? "Kept private to you.")}</p>
              </div>
            ))}
        </section>
      )}
      <ul className="space-y-3">
        {data.board.map((s) => (
          <li key={s._id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <AnatomyBadge anatomyKey={s.anatomyKey} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">Instead of {s.insteadOf}</p>
                <p className="text-lg font-bold leading-snug">{s.use}</p>
                {s.note && <p className="mt-1">{s.note}</p>}
                <p className="mt-1 text-xs text-muted">Posted by someone with {s.anatomyLabel}</p>
                <Badges synthetic={s.synthetic} />
                <Cites citations={s.citations} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => run(upvote({ anonId, swapId: s._id }))}
                aria-pressed={s.youVoted}
                className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${s.youVoted ? "border-accent bg-accent-soft" : "border-border"}`}
              >
                <span className="inline-flex items-center gap-1">
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                  {s.upvotes}
                  <span className="sr-only"> upvotes. Upvote this swap</span>
                </span>
              </button>
            </div>
          </li>
        ))}
        {data.board.length === 0 && <li className="text-muted">No swaps for this anatomy yet.</li>}
      </ul>
    </div>
  );
}

function CareTeam({ anonId, filter }: { anonId: string; filter: string }) {
  const data = useQuery(api.careTeam.list, { anonId, anatomy: filter });
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.catch((e) => setError(friendlyError(e)));
  if (!data) return <Loading inline />;
  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">
        What other users&apos; own pharmacists, dietitians, doctors and nurses told them. Reported by another user from
        their own care team, not advice from yours. Log your own from the{" "}
        <Link href="/sheet" className="font-bold text-accent underline">
          appointment sheet
        </Link>
        .
      </p>
      <ul className="space-y-3">
        {data.answers.map((a) => (
          <li key={a._id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <AnatomyBadge anatomyKey={a.anatomyKey} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {a.professionalType}
                  {a.item ? ` · ${a.item}` : ""}
                </p>
                <p className="font-bold">{a.question}</p>
                <p className="mt-1">{a.answer}</p>
                <p className="mt-1 text-xs text-muted">Reported by someone with {a.anatomyLabel}</p>
                <Badges synthetic={a.synthetic} />
              </div>
            </div>
          </li>
        ))}
        {data.answers.length === 0 && <li className="text-muted">No care-team answers for this anatomy yet.</li>}
      </ul>
    </div>
  );
}

function Community({ anonId }: { anonId: string }) {
  const profile = useQuery(api.profiles.me, { anonId });
  const [tab, setTab] = useState<"swaps" | "care">("swaps");
  const [filter, setFilter] = useState("mine");
  if (profile === undefined) return <Loading />;
  if (profile === null)
    return (
      <p className="pt-10 text-center">
        <Link href="/" className="font-bold text-accent underline">
          Set up a profile first
        </Link>
      </p>
    );

  return (
    <main className="space-y-4 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold">Community</h1>
      <p className="text-sm text-muted">
        Patients teaching each other what bodies like theirs tolerate. No messages, no comments, no profiles: just swaps
        and care-team answers, checked against the guidelines and screened before they appear.
      </p>
      <div role="group" aria-label="Show" className="grid grid-cols-2 gap-2">
        {(
          [
            ["swaps", "Swaps to ask about"],
            ["care", "Care-team answers"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={`min-h-11 rounded-xl border font-bold ${tab === k ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Filter by anatomy">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm ${filter === f.key ? "border-accent bg-accent-soft font-bold" : "border-border bg-surface"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {tab === "swaps" ? (
        <Swaps anonId={anonId} filter={filter} />
      ) : (
        <>
          <CareOutcomesList anonId={anonId} filter={filter} />
          <CareTeam anonId={anonId} filter={filter} />
        </>
      )}
    </main>
  );
}

export default function CommunityPage() {
  const anonId = useAnonId();
  if (!anonId) return <Loading />;
  return <Community anonId={anonId} />;
}
