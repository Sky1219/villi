"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FOOD_MESSAGE, type Answer } from "@convex/lib/answerSchema";
import { useAnonId } from "@/lib/anon";
import { citationLabel } from "@/lib/citations";
import { friendlyError } from "@/lib/errors";
import { GutDiagram } from "@/components/GutDiagram";
import { CommunityCounts } from "@/components/CommunityCounts";
import { CareOutcomes } from "@/components/CareOutcomes";
import { LogCard } from "@/components/LogCard";
import type { SegmentId } from "@convex/lib/anatomy";
import { personFor } from "@convex/lib/careFor";

type FinalAnswer = Answer & { evidence?: Record<string, { kind: string; text: string }>; communitySynthetic?: boolean };
type Trace = { step: number; tool: string; summary: string; ok: boolean; at: number };

const TOOL_LABEL: Record<string, string> = {
  get_profile: "Read your anatomy",
  read_photo: "Read the photo",
  fetch_label: "FDA label",
  search_guidelines: "Clinical guidelines",
  query_community: "Community logs",
  query_my_log: "Your own log",
  canonicalize_item: "Identified as",
  query_swaps: "Swaps board",
  query_care_team_answers: "Care-team answers",
  query_care_outcomes: "What care teams changed",
  lookup_ors: "ORS reference",
  match_pill: "Your medicines",
  safety_lint: "Safety check",
  submit_answer: "Drafted answer",
  reviewer: "Second reviewer",
};

const isWorking = (status: string) => status === "queued" || status === "running" || status === "reviewing";

function TraceSteps({ trace }: { trace: Trace[] }) {
  return (
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
  );
}

// While the agent works, the trace is the page. Once an answer is final it moves into the receipt at the end.
function TraceList({ trace, status }: { trace: Trace[]; status: string }) {
  const working = isWorking(status);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-muted">
        {working && <span className="inline-block h-2 w-2 rounded-full bg-accent motion-safe:animate-[villi-pulse_1.2s_ease-in-out_infinite]" />}
        {status === "reviewing" ? "Safety review in progress…" : working ? "Checking sources…" : "What Villi checked"}
      </h2>
      <TraceSteps trace={trace} />
    </section>
  );
}

function Receipt({
  trace,
  final,
  edited,
}: {
  trace: Trace[];
  final: FinalAnswer;
  edited: boolean;
}) {
  const hasLabel = JSON.stringify(final.why).includes("[L:");
  return (
    <section className="space-y-2">
      <details className="group rounded-2xl border border-border bg-surface px-4 text-sm">
        <summary className="flex min-h-12 cursor-pointer items-center font-bold">
          How Villi checked this ({trace.length} steps, {final.sourcesChecked.length} sources)
        </summary>
        <div className="space-y-4 pb-4">
          <TraceSteps trace={trace} />
          {final.sourcesChecked.length > 0 && (
            <div>
              <h3 className="mb-1 font-bold">Sources I checked</h3>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {final.sourcesChecked.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-muted">
            {edited ? "A second reviewer checked this answer and edited it before you saw it." : "A second reviewer checked this answer before you saw it."}
          </p>
        </div>
      </details>
      <Link href="/how" className="inline-flex min-h-11 items-center text-sm font-bold text-accent underline">
        How Villi decides
      </Link>
      {hasLabel && (
        <p className="text-xs text-muted">
          FDA label text via openFDA. openFDA says not to rely on it alone for decisions about medical care; that&apos;s why
          every answer ends with a question for your pharmacist or doctor.
        </p>
      )}
    </section>
  );
}

type SourceInfo = { title: string; section: string | null; verifiedAgainst: string | null };

function Citations({ citation, final, titles }: { citation: string; final: FinalAnswer; titles: Record<string, SourceInfo> }) {
  const [open, setOpen] = useState<string | null>(null);
  const cites = Array.from(citation.matchAll(/\[(G|L|C|T):([^\]]+)\]/g), (m) => ({ kind: m[1], ref: m[2].trim() }));
  return (
    <span className="block">
      <span className="flex flex-wrap gap-x-1">
        {cites.map((c) => {
          const key = `${c.kind}:${c.ref}`;
          // 44px tap area around a 32px pill; the label says it opens the source.
          return (
            <button
              key={key}
              onClick={() => setOpen(open === key ? null : key)}
              aria-expanded={open === key}
              aria-label={`Source: ${citationLabel(c.kind, c.ref)}`}
              className="flex min-h-11 items-center"
            >
              <span className="inline-flex min-h-8 items-center rounded-full bg-info-soft px-2.5 text-xs font-bold text-info">
                {citationLabel(c.kind, c.ref)}
                {c.kind === "C" && final.communitySynthetic && " · demo data"}
              </span>
            </button>
          );
        })}
      </span>
      {open && (
        <span className="mt-2 block rounded-xl bg-info-soft p-3 text-sm">
          {final.evidence?.[open] && open.startsWith("G:") ? (
            // Guideline chunks are our own summaries of the source, so they are not shown as quotes.
            <>
              <span className="block text-foreground">{final.evidence[open].text}</span>
              <span className="mt-1 block text-xs text-muted">
                Villi&apos;s summary of: {titles[open]?.title ?? "this source"}
                {titles[open]?.section ? `, ${titles[open].section}` : ""}.{" "}
                {titles[open]?.verifiedAgainst
                  ? `Wording checked by Claude against the ${titles[open].verifiedAgainst}; not yet reviewed by a clinician.`
                  : "Not yet checked against the source text or by a clinician."}
              </span>
            </>
          ) : final.evidence?.[open] ? (
            <mark className="bg-transparent text-foreground">&ldquo;{final.evidence[open].text}&rdquo;</mark>
          ) : (
            <span className="text-muted">{open.startsWith("C:") ? "Self-reported by other users, not a trial." : "Source text not available."}</span>
          )}
          {titles[open] && !open.startsWith("G:") && <span className="mt-1 block text-xs text-muted">{titles[open].title}</span>}
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

function AnswerCard({
  final,
  answerId,
  anonId,
  itemId,
}: {
  final: FinalAnswer;
  answerId: Id<"answers">;
  anonId: string;
  itemId: Id<"items"> | null;
}) {
  const gIds = Array.from(
    new Set(
      [
        ...final.why.map((w) => w.citation),
        final.swapToAskAbout?.citation ?? "",
        final.diagram?.citation ?? "",
        final.simulation?.citation ?? "",
      ].flatMap((c) =>
        Array.from(c.matchAll(/\[G:([^\]]+)\]/g), (m) => m[1].trim()),
      ),
    ),
  );
  const chunks = useQuery(api.questions.citationsFor, { anonId, chunkIds: gIds });
  const profile = useQuery(api.profiles.me, { anonId });
  const titles: Record<string, SourceInfo> = Object.fromEntries(
    (chunks ?? []).map((c) => [`G:${c.chunkId}`, { title: c.sourceTitle, section: c.section, verifiedAgainst: c.verifiedAgainst }]),
  );
  const style = STATE_STYLE[final.state] ?? STATE_STYLE["cant-tell"];
  // Only a caption the review filled in by rule is ever drawn.

  const lang = profile?.language ?? "en";
  // Reading order: verdict, the reasoning behind it, the question to take away, then supporting evidence.
  return (
    <div className="space-y-8" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="space-y-3">
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
      </div>

      <QuestionCard ask={final.ask} answerId={answerId} anonId={anonId} />

      <div className="space-y-3">
      {itemId && <CareOutcomes anonId={anonId} itemId={itemId} />}
      {itemId ? (
        <CommunityCounts anonId={anonId} itemId={itemId} />
      ) : (
        final.community &&
        final.community.matchingAnatomy.helped + final.community.matchingAnatomy.neutral + final.community.matchingAnatomy.hurt > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 flex items-center gap-2 font-bold">
              People with your anatomy
              {(final.communitySynthetic ?? final.community.includesSynthetic) && (
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">demo data</span>
              )}
            </h2>
            <Counts c={final.community.matchingAnatomy} />
            <p className="mt-2 text-xs text-muted">Self-reported by other users, not a trial. Evidence, not a recommendation.</p>
          </section>
        )
      )}

      {final.careTeamAnswers.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-1 font-bold">What other people&apos;s care teams told them</h2>
          <p className="mb-3 text-xs text-muted">
            Reported by other users from their own care team. Not advice from yours.
          </p>
          <ul className="space-y-3">
            {final.careTeamAnswers.map((c) => (
              <li key={c.id} className="rounded-xl bg-surface-2 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{c.professionalType}</p>
                <p>{prose(c.summary)}</p>
              </li>
            ))}
          </ul>
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
      </div>
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
        {c.helped} helped · {c.neutral} no change · {c.hurt} worse <span className="text-muted">(of {total})</span>
      </p>
    </div>
  );
}

function QuestionCard({ ask, answerId, anonId }: { ask: string; answerId: Id<"answers">; anonId: string }) {
  const add = useMutation(api.questions.addFromAnswer);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border-2 border-accent bg-accent-soft p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">Ask your pharmacist or doctor</h2>
      <p className="text-lg font-bold leading-snug">{prose(ask.replace(/^ASK:\s*/, ""))}</p>
      <button
        disabled={added}
        onClick={async () => {
          setError(null);
          try {
            await add({ anonId, answerId });
            setAdded(true);
          } catch (e) {
            setError(friendlyError(e));
          }
        }}
        className="mt-3 min-h-12 w-full rounded-xl bg-accent px-4 font-bold text-accent-ink disabled:opacity-70"
      >
        {added ? "Added to appointment sheet ✓" : "Add to appointment sheet"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </section>
  );
}

function Useful({ anonId, answerId, value }: { anonId: string; answerId: Id<"answers">; value: boolean | null }) {
  const rate = useMutation(api.answers.rateUseful);
  const [error, setError] = useState<string | null>(null);
  const pick = async (useful: boolean) => {
    setError(null);
    try {
      await rate({ anonId, answerId, useful });
    } catch (e) {
      setError(friendlyError(e));
    }
  };
  const btn = (on: boolean) =>
    `min-h-11 flex-1 rounded-xl border px-3 text-sm font-bold ${on ? "border-accent bg-accent-soft text-accent" : "border-border"}`;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 id="useful" className="mb-2 font-bold">
        Was this useful?
      </h2>
      <div role="group" aria-labelledby="useful" className="flex gap-2">
        <button onClick={() => pick(true)} aria-pressed={value === true} className={btn(value === true)}>
          Yes
        </button>
        <button onClick={() => pick(false)} aria-pressed={value === false} className={btn(value === false)}>
          Not really
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </section>
  );
}

const PROBLEMS = [
  ["wrong_item", "Wrong medicine identified"],
  ["unsupported_claim", "A claim isn't supported by its source"],
  ["confusing", "Confusing"],
  ["other", "Other"],
] as const;

function SomethingWrong({ anonId, answerId, value }: { anonId: string; answerId: Id<"answers">; value: string | null }) {
  const report = useMutation(api.answers.reportProblem);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 id="wrong" className="mb-1 font-bold">
        Something wrong with this answer?
      </h2>
      <p className="mb-2 text-xs text-muted">One tap. It marks this answer for a closer look; nothing else is sent.</p>
      <div role="group" aria-labelledby="wrong" className="grid grid-cols-2 gap-2">
        {PROBLEMS.map(([k, label]) => (
          <button
            key={k}
            aria-pressed={value === k}
            onClick={async () => {
              setError(null);
              try {
                await report({ anonId, answerId, kind: value === k ? null : k });
              } catch (e) {
                setError(friendlyError(e));
              }
            }}
            className={`min-h-11 rounded-xl border px-3 text-left text-sm ${value === k ? "border-accent bg-accent-soft font-bold text-accent" : "border-border"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {value && <p className="mt-2 text-sm text-muted">Thanks. Marked for a closer look.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </section>
  );
}

function FollowUp({ anonId, parentId }: { anonId: string; parentId: Id<"answers"> }) {
  const start = useMutation(api.answers.start);
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rounded-2xl border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        setError(null);
        try {
          const id = await start({ anonId, text: text.trim(), parentId });
          router.push(`/answer/${id}`);
        } catch (err) {
          setError(friendlyError(err));
          setBusy(false);
        }
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
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </form>
  );
}

function AnswerView({ anonId, answerId }: { anonId: string; answerId: Id<"answers"> }) {
  const a = useQuery(api.answers.get, { anonId, answerId });
  const profile = useQuery(api.profiles.me, { anonId });
  const start = useMutation(api.answers.start);
  const router = useRouter();
  const [retryError, setRetryError] = useState<string | null>(null);
  if (a === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  if (a === null) return <p className="pt-10 text-center">Answer not found on this device.</p>;
  const final = a.final as FinalAnswer | null;
  const retryText = a.identified ?? a.inputText;
  const done = !!final && a.status === "final";
  const itemName = a.identified ?? a.inputText;
  const person = profile ? personFor(profile.role, profile.caresFor) : "you";
  const statusLine = done
    ? `Answer ready: ${(STATE_STYLE[final.state] ?? STATE_STYLE["cant-tell"]).tag}.`
    : a.status === "reviewing"
      ? "Safety review in progress."
      : isWorking(a.status)
        ? "Checking sources."
        : a.status === "blocked"
          ? "This answer didn't pass the safety check."
          : a.status === "failed"
            ? "Something went wrong."
            : "";

  return (
    <main className="space-y-4 pt-4">
      <p role="status" className="sr-only">
        {statusLine}
      </p>
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
        {a.kind === "scan" && !a.isSaw && a.identified && a.hadPhoto === false && a.inputText === null && (
          <p className="text-sm text-muted">Read from your photo.</p>
        )}
        {a.kind === "scan" && !a.isSaw && a.identified && (
          <Link
            href={`/?q=${encodeURIComponent(a.identified)}`}
            className="inline-flex min-h-11 items-center text-sm font-bold text-accent underline"
          >
            Not right? Type the name instead
          </Link>
        )}
      </section>

      {!done && <TraceList trace={a.toolTrace} status={a.status} />}

      {done && <AnswerCard final={final} answerId={a._id} anonId={anonId} itemId={a.itemId} />}

      {(a.status === "failed" || a.status === "blocked") && (
        <section className="rounded-2xl border border-border bg-surface-2 p-4">
          <p className="font-bold">
            {a.status === "blocked"
              ? "This answer didn't pass the safety check."
              : a.error === FOOD_MESSAGE
                ? "Villi checks pills and drinks."
                : "Something went wrong."}
          </p>
          <p className="mt-1 text-sm text-muted">{a.error}</p>
          {a.error === FOOD_MESSAGE && (
            <Link href="/" className="mt-3 inline-flex min-h-12 items-center font-bold text-accent underline">
              Log how a food went
            </Link>
          )}
          {retryText && !a.isSaw && a.error !== FOOD_MESSAGE && (
            <button
              onClick={async () => {
                try {
                  const id = await start({ anonId, text: retryText });
                  router.push(`/answer/${id}`);
                } catch (e) {
                  setRetryError(friendlyError(e));
                }
              }}
              className="mt-3 min-h-12 w-full rounded-xl border border-accent px-4 font-bold text-accent"
            >
              Try again
            </button>
          )}
          {retryError && (
            <p role="alert" className="mt-2 text-sm text-flag">
              {retryError}
            </p>
          )}
        </section>
      )}

      {done && (
        <div className="space-y-3 pt-4">
          <Useful anonId={anonId} answerId={a._id} value={a.useful} />
          <SomethingWrong anonId={anonId} answerId={a._id} value={a.problemReport} />
          <FollowUp anonId={anonId} parentId={a.kind === "followup" && a.parentId ? a.parentId : a._id} />
          {a.itemId && itemName && <LogCard anonId={anonId} answerId={a._id} itemName={itemName} person={person} />}
        </div>
      )}

      {done && <Receipt trace={a.toolTrace} final={final} edited={!!a.reviewSummary?.edited} />}
    </main>
  );
}

export default function AnswerPage() {
  const anonId = useAnonId();
  const { id } = useParams<{ id: string }>();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <AnswerView anonId={anonId} answerId={id as Id<"answers">} />;
}
