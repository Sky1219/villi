"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Answer } from "@convex/lib/answerSchema";
import { useAnonId } from "@/lib/anon";
import { GutDiagram } from "@/components/GutDiagram";
import type { SegmentId } from "@convex/lib/anatomy";

type FinalAnswer = Answer & { evidence?: Record<string, { kind: string; text: string }> };
type Trace = { step: number; tool: string; summary: string; ok: boolean; at: number };

const TOOL_LABEL: Record<string, string> = {
  get_profile: "Read your anatomy",
  read_photo: "Read the photo",
  fetch_label: "FDA label",
  search_guidelines: "Clinical guidelines",
  query_community: "Community logs",
  query_my_log: "Your own log",
  safety_lint: "Safety check",
  submit_answer: "Drafted answer",
  reviewer: "Second reviewer",
};

function TraceList({ trace, status }: { trace: Trace[]; status: string }) {
  const working = status === "queued" || status === "running" || status === "reviewing";
  return (
    <section aria-live="polite" className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-muted">
        {working && <span className="inline-block h-2 w-2 rounded-full bg-accent motion-safe:animate-[villi-pulse_1.2s_ease-in-out_infinite]" />}
        {status === "reviewing" ? "Safety review in progress…" : working ? "Checking sources…" : "What Villi checked"}
      </h2>
      <ol className="space-y-2">
        {trace.map((t) => (
          <li key={t.step} className="flex gap-2 text-sm">
            <span aria-hidden className={t.ok ? "text-ok" : "text-flag"}>
              {t.ok ? "✓" : "!"}
            </span>
            <span>
              <span className="font-bold">{TOOL_LABEL[t.tool] ?? t.tool}</span>{" "}
              <span className="text-muted">{t.summary}</span>
            </span>
          </li>
        ))}
        {trace.length === 0 && <li className="text-sm text-muted">Starting…</li>}
      </ol>
    </section>
  );
}

function citationLabel(kind: string, ref: string): string {
  if (kind === "G") {
    const src = ref.split("#")[0];
    return (
      { "aga-sbs": "AGA 2022", pg139: "Pract Gastro 2015", "pd-2017": "Parrish & DiBaise 2017", "remane-2025": "Remane 2025", "sood-2013": "Aust Prescr 2013", "hong-2021": "Hong 2021", "who-ors": "WHO ORS" }[src] ??
      src
    );
  }
  if (kind === "L") return `FDA label: ${ref.replace(/_/g, " ")}`;
  if (kind === "C") return `Community ${ref}`;
  return "Another user's care team";
}

function Citations({ citation, final, titles }: { citation: string; final: FinalAnswer; titles: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);
  const cites = Array.from(citation.matchAll(/\[(G|L|C|T):([^\]]+)\]/g), (m) => ({ kind: m[1], ref: m[2].trim() }));
  return (
    <span className="block">
      <span className="mt-1 flex flex-wrap gap-1">
        {cites.map((c) => {
          const key = `${c.kind}:${c.ref}`;
          return (
            <button
              key={key}
              onClick={() => setOpen(open === key ? null : key)}
              aria-expanded={open === key}
              className="min-h-8 rounded-full bg-info-soft px-2.5 py-1 text-xs font-bold text-info"
            >
              {citationLabel(c.kind, c.ref)}
            </button>
          );
        })}
      </span>
      {open && (
        <span className="mt-2 block rounded-xl border-l-4 border-info bg-info-soft/50 p-3 text-sm">
          {final.evidence?.[open] ? (
            <mark className="bg-transparent text-foreground">&ldquo;{final.evidence[open].text}&rdquo;</mark>
          ) : (
            <span className="text-muted">{open.startsWith("C:") ? "Self-reported by other users, not a trial." : "Source text not available."}</span>
          )}
          {titles[open] && <span className="mt-1 block text-xs text-muted">{titles[open]}</span>}
        </span>
      )}
    </span>
  );
}

const CITE_RE = /\s*\[(G|L|C|T):[^\]]+\]/g;
const prose = (t: string) => t.replace(CITE_RE, "").trim();
const inlineCites = (t: string) => (t.match(CITE_RE) ?? []).map((c) => c.trim()).join(" ");

const STATE_STYLE = {
  flagged: { box: "bg-flag-soft border-flag", tag: "Flag to discuss", tagCls: "text-flag" },
  "nothing-found": { box: "bg-surface border-border", tag: "Nothing found in the sources I checked", tagCls: "text-muted" },
  "cant-tell": { box: "bg-surface-2 border-border", tag: "Can't tell yet", tagCls: "text-muted" },
} as const;

function AnswerCard({ final, answerId, anonId }: { final: FinalAnswer; answerId: Id<"answers">; anonId: string }) {
  const gIds = Array.from(
    new Set(
      [...final.why.map((w) => w.citation), final.swapToAskAbout?.citation ?? "", final.diagram?.citation ?? ""].flatMap((c) =>
        Array.from(c.matchAll(/\[G:([^\]]+)\]/g), (m) => m[1].trim()),
      ),
    ),
  );
  const chunks = useQuery(api.questions.citationsFor, { anonId, chunkIds: gIds });
  const profile = useQuery(api.profiles.me, { anonId });
  const titles: Record<string, string> = Object.fromEntries((chunks ?? []).map((c) => [`G:${c.chunkId}`, c.sourceTitle]));
  const hasLabel = JSON.stringify(final.why).includes("[L:");
  const style = STATE_STYLE[final.state] ?? STATE_STYLE["cant-tell"];

  return (
    <div className="space-y-4">
      <section className={`rounded-2xl border-2 p-4 ${style.box}`}>
        <p className={`mb-1 text-xs font-bold uppercase tracking-wide ${style.tagCls}`}>{style.tag}</p>
        <p className="text-xl font-bold leading-snug">{prose(final.verdict)}</p>
        {inlineCites(final.verdict) && <Citations citation={inlineCites(final.verdict)} final={final} titles={titles} />}
      </section>

      {profile && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-bold">{final.diagram ? "Where this matters in your gut" : "Your anatomy"}</h2>
          <GutDiagram
            removed={profile.diagram.removed}
            stoma={profile.diagram.stomaAfter ? { afterSegment: profile.diagram.stomaAfter } : null}
            highlight={
              final.diagram
                ? { segmentIds: final.diagram.segmentIds as SegmentId[], mode: final.diagram.mode, label: final.diagram.label }
                : null
            }
          />
          {final.diagram && <Citations citation={final.diagram.citation} final={final} titles={titles} />}
        </section>
      )}

      {final.why.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-bold">Why</h2>
          <ul className="space-y-3">
            {final.why.map((w, i) => (
              <li key={i}>
                <span className="block">{prose(w.claim)}</span>
                <Citations citation={`${w.citation} ${inlineCites(w.claim)}`} final={final} titles={titles} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {final.swapToAskAbout && (
        <section className="rounded-2xl border border-border bg-ok-soft p-4">
          <h2 className="mb-1 font-bold">A swap to ask about</h2>
          <p>{prose(final.swapToAskAbout.text)}</p>
          <p className="mt-1 text-xs text-muted">
            From {final.swapToAskAbout.source === "community" ? "the community swaps board" : "the guidelines"}. Ask before changing anything.
          </p>
          <Citations citation={final.swapToAskAbout.citation} final={final} titles={titles} />
        </section>
      )}

      {final.community && final.community.matchingAnatomy.helped + final.community.matchingAnatomy.neutral + final.community.matchingAnatomy.hurt > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            People with your anatomy
            {final.community.includesSynthetic && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">demo data</span>
            )}
          </h2>
          <Counts c={final.community.matchingAnatomy} />
          <p className="mt-2 text-xs text-muted">Self-reported by other users, not a trial. Evidence, not a recommendation.</p>
        </section>
      )}

      {final.personal.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-bold">Your own log</h2>
          <ul className="list-disc space-y-1 pl-5">
            {final.personal.map((p, i) => (
              <li key={i}>{prose(p)}</li>
            ))}
          </ul>
        </section>
      )}

      <QuestionCard ask={final.ask} answerId={answerId} anonId={anonId} />

      {final.sourcesChecked.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-bold">Sources I checked ({final.sourcesChecked.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {final.sourcesChecked.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Confidence: {final.confidence}</p>
        </details>
      )}
      {hasLabel && (
        <p className="text-xs text-muted">
          FDA label text via openFDA. openFDA says not to rely on it alone for decisions about medical care; that&apos;s why
          every answer ends with a question for your pharmacist or doctor.
        </p>
      )}
    </div>
  );
}

function Counts({ c }: { c: { helped: number; neutral: number; hurt: number } }) {
  const total = c.helped + c.neutral + c.hurt;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <span className="bg-ok" style={{ width: pct(c.helped) }} />
        <span className="bg-removed" style={{ width: pct(c.neutral) }} />
        <span className="bg-flag" style={{ width: pct(c.hurt) }} />
      </div>
      <p className="mt-1 text-sm">
        {c.helped} helped · {c.neutral} no change · {c.hurt} hurt <span className="text-muted">(of {total})</span>
      </p>
    </div>
  );
}

function QuestionCard({ ask, answerId, anonId }: { ask: string; answerId: Id<"answers">; anonId: string }) {
  const add = useMutation(api.questions.addFromAnswer);
  const [added, setAdded] = useState(false);
  return (
    <section className="rounded-2xl border-2 border-accent bg-accent-soft p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">Ask your pharmacist or doctor</h2>
      <p className="text-lg font-bold leading-snug">{prose(ask.replace(/^ASK:\s*/, ""))}</p>
      <button
        disabled={added}
        onClick={async () => {
          await add({ anonId, answerId });
          setAdded(true);
        }}
        className="mt-3 min-h-12 w-full rounded-xl bg-accent px-4 font-bold text-accent-ink disabled:opacity-70"
      >
        {added ? "Added to appointment sheet ✓" : "Add to appointment sheet"}
      </button>
    </section>
  );
}

function FollowUp({ anonId, parentId }: { anonId: string; parentId: Id<"answers"> }) {
  const start = useMutation(api.answers.start);
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="rounded-2xl border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        const id = await start({ anonId, text: text.trim(), parentId, category: "pill" });
        router.push(`/answer/${id}`);
      }}
    >
      <label htmlFor="followup" className="mb-2 block font-bold">
        Ask a follow-up
      </label>
      <div className="flex gap-2">
        <input
          id="followup"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Can I crush it?"
          className="min-h-12 flex-1 rounded-xl border border-border bg-background px-3"
        />
        <button disabled={busy || !text.trim()} className="min-h-12 rounded-xl border border-accent px-4 font-bold text-accent disabled:opacity-50">
          Ask
        </button>
      </div>
    </form>
  );
}

function AnswerView({ anonId, answerId }: { anonId: string; answerId: Id<"answers"> }) {
  const a = useQuery(api.answers.get, { anonId, answerId });
  const start = useMutation(api.answers.start);
  const router = useRouter();
  if (a === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  if (a === null) return <p className="pt-10 text-center">Answer not found on this device.</p>;
  const final = a.final as FinalAnswer | null;
  const retryText = a.identified ?? a.inputText;

  return (
    <main className="space-y-4 pt-4">
      <div className="flex gap-4">
        <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
          ← Home
        </Link>
        {a.parentId && (
          <Link href={`/answer/${a.parentId}`} className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
            Back to the first answer
          </Link>
        )}
      </div>
      <section>
        <p className="text-sm text-muted">{a.kind === "followup" ? "Follow-up" : "Checking"}</p>
        <h1 className="text-2xl font-bold">{a.kind === "followup" ? a.inputText : (a.identified ?? a.inputText ?? "Your photo")}</h1>
        {a.kind === "scan" && a.identified && a.hadPhoto === false && a.inputText === null && (
          <p className="text-sm text-muted">Read from your photo.</p>
        )}
        {a.kind === "scan" && a.identified && (
          <Link href={`/?fix=1`} className="text-sm font-bold text-accent underline">
            Not right? Type the name instead
          </Link>
        )}
      </section>

      <TraceList trace={a.toolTrace} status={a.status} />

      {final && a.status === "final" && <AnswerCard final={final} answerId={a._id} anonId={anonId} />}
      {final && a.reviewSummary?.edited && (
        <p className="text-xs text-muted">The second reviewer edited this answer before you saw it.</p>
      )}

      {(a.status === "failed" || a.status === "blocked") && (
        <section className="rounded-2xl border border-border bg-surface-2 p-4">
          <p className="font-bold">{a.status === "blocked" ? "This answer didn't pass the safety check." : "Something went wrong."}</p>
          <p className="mt-1 text-sm text-muted">{a.error}</p>
          {retryText && (
            <button
              onClick={async () => {
                const id = await start({ anonId, text: retryText, category: "pill" });
                router.push(`/answer/${id}`);
              }}
              className="mt-3 min-h-12 w-full rounded-xl border border-accent px-4 font-bold text-accent"
            >
              Try again
            </button>
          )}
        </section>
      )}

      {a.status === "final" && <FollowUp anonId={anonId} parentId={a.kind === "followup" && a.parentId ? a.parentId : a._id} />}
    </main>
  );
}

export default function AnswerPage() {
  const anonId = useAnonId();
  const { id } = useParams<{ id: string }>();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <AnswerView anonId={anonId} answerId={id as Id<"answers">} />;
}
