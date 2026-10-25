"use client";

import Link from "next/link";
import { ShowPharmacist } from "@/components/ShowPharmacist";
import { displayName } from "@/lib/displayName";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAnonId } from "@/lib/anon";
import { friendlyError } from "@/lib/errors";
import { LogStatus } from "@/components/LogCard";
import { CHANGE_CHOICES, CHANGE_SHORT, OUTCOME_WORD, patternSentence, requestMarkdown, warningSentence, type ResultingChange } from "@/lib/sheet";
import { personFor, preparedBy } from "@convex/lib/careFor";
import { MedReview } from "@/components/MedReview";
import { ShareWithTeam } from "@/components/ShareWithTeam";
import { CheckNewForm } from "@/components/AfterChange";
import { Loading } from "@/components/Loading";

const PROS = ["pharmacist", "dietitian", "doctor", "nurse"] as const;

function LogAnswer({ anonId, questionId, startOpen = false }: { anonId: string; questionId: Id<"questions">; startOpen?: boolean }) {
  const log = useMutation(api.careTeam.logAnswer);
  const [opened, setOpen] = useState(false);
  // Opened by a tap, or by the home nudge's link to this question.
  const open = opened || startOpen;
  const [pro, setPro] = useState<(typeof PROS)[number]>("pharmacist");
  const [text, setText] = useState("");
  const [change, setChange] = useState<ResultingChange>("pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 min-h-11 rounded-xl border border-accent px-3 text-sm font-bold text-accent">
        What did they say?
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await log({ anonId, questionId, professionalType: pro, answerText: text, resultingChange: change });
        } catch (err) {
          setError(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-bold">Who answered?</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPro(p)}
              aria-pressed={pro === p}
              className={`min-h-11 rounded-xl border text-sm capitalize ${pro === p ? "border-accent bg-accent-soft font-bold" : "border-border"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        What they said, in your own words
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          required
          className="mt-1 w-full rounded-xl border border-border bg-background p-3"
        />
      </label>
      <ChangeChoices value={change} onPick={setChange} />
      <p className="text-xs text-muted">
        Shared anonymously with people who have your anatomy, labeled as your care team&apos;s answer, after a safety
        check. Leave out names and doses.
      </p>
      <button disabled={busy || !text.trim()} className="min-h-12 w-full rounded-xl bg-accent font-bold text-accent-ink disabled:opacity-60">
        Save answer
      </button>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </form>
  );
}

function ChangeChoices({ value, onPick }: { value: ResultingChange | null; onPick: (c: ResultingChange) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold">What changed because of it?</legend>
      <div className="grid gap-2">
        {CHANGE_CHOICES.map(([c, label]) => (
          <button
            type="button"
            key={c}
            onClick={() => onPick(c)}
            aria-pressed={value === c}
            className={`min-h-11 rounded-xl border px-3 text-left text-sm ${value === c ? "border-accent bg-accent-soft font-bold" : "border-border"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// "I asked this": the question moves from open to asked, and back if tapped by mistake.
function AskedToggle({ anonId, questionId, asked }: { anonId: string; questionId: Id<"questions">; asked: boolean }) {
  const setAsked = useMutation(api.questions.setAsked);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        onClick={async () => {
          setError(null);
          try {
            await setAsked({ anonId, questionId, asked: !asked });
          } catch (e) {
            setError(friendlyError(e));
          }
        }}
        aria-pressed={asked}
        className={`mt-2 mr-2 min-h-11 rounded-xl border px-3 text-sm font-bold ${asked ? "border-accent bg-accent-soft text-accent" : "border-border"}`}
      >
        {asked ? "Asked ✓" : "I asked this"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </>
  );
}

// Outcome of a logged answer; "not decided yet" can be updated when the team decides.
function Outcome({ anonId, id, value }: { anonId: string; id: Id<"care_team_answers">; value: ResultingChange | null }) {
  const set = useMutation(api.careTeam.setResultingChange);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!editing) {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-bold">Outcome:</span> {value ? CHANGE_SHORT[value] : "not logged"}
        {(value === "pending" || value === null) && (
          <button onClick={() => setEditing(true)} className="min-h-11 font-bold text-accent underline">
            Update
          </button>
        )}
      </p>
    );
  }
  return (
    <div className="mt-2">
      <ChangeChoices
        value={value}
        onPick={async (c) => {
          setError(null);
          try {
            await set({ anonId, id, resultingChange: c });
            setEditing(false);
          } catch (e) {
            setError(friendlyError(e));
          }
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </div>
  );
}

function Sheet({ anonId }: { anonId: string }) {
  const d = useQuery(api.sheet.get, { anonId });
  // "Log what they said" on the home nudge links to #answer-<id> and opens that form.
  const [target, setTarget] = useState("");
  useEffect(() => {
    const read = () => setTarget(window.location.hash.replace(/^#answer-/, ""));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (d && target) document.getElementById(`answer-${target}`)?.scrollIntoView();
  }, [d, target]);
  const [copied, setCopied] = useState(false);
  if (!d) return <Loading />;
  const date = new Date().toLocaleDateString(d.language);
  const md = () => requestMarkdown(d, date);

  async function share() {
    const text = md();
    const file = new File([text], "villi-medication-review-request.md", { type: "text/markdown" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Medication review request" });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([md()], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "villi-medication-review-request.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="space-y-5 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Appointment sheet</h1>
        <p className="text-sm text-muted">
          Patient&apos;s anatomy: {d.anatomyText}
          {!d.anatomyConfirmed && " (not confirmed: assuming the most cautious case)"}
        </p>
        <p className="text-sm text-muted">Prepared by {preparedBy(d.role, d.caresFor)}. Either of you can hand it to the clinician.</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/sheet/print" className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-3 text-center font-bold text-accent-ink">
          Review request (PDF)
        </Link>
        <button onClick={share} className="min-h-12 rounded-xl border border-accent px-3 font-bold text-accent">
          {copied ? "Copied ✓" : "Share or copy"}
        </button>
        <button onClick={download} className="col-span-2 min-h-11 text-sm font-bold text-accent underline">
          Download as Markdown
        </button>
        <Link href="/fridge" className="col-span-2 flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-3 font-bold">
          Fridge sheet: drinks for this anatomy
        </Link>
      </div>

      <ShareWithTeam anonId={anonId} />

      <section className="space-y-3">
        <h2 className="font-bold">Questions to ask ({d.open.length})</h2>
        {d.open.length === 0 && <p className="text-muted">No open questions. Add one from any answer&apos;s question card.</p>}
        <ShowPharmacist
          questions={d.open.map((q) => ({ item: q.itemName ? displayName(q.itemName) : null, question: q.text }))}
          label={d.open.length === 1 ? "Show this question to the pharmacist" : "Show these questions to the pharmacist"}
        />
        {d.open.map((q) => (
          <div key={q._id} id={`answer-${q._id}`} className="scroll-mt-4 rounded-2xl border border-border bg-surface p-4">
            {q.status === "asked" && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-accent">Asked</p>}
            <p className="font-bold">{q.text}</p>
            {q.itemName && <p className="text-xs text-muted">about {q.itemName}</p>}
            <AskedToggle anonId={anonId} questionId={q._id} asked={q.status === "asked"} />
            <LogAnswer anonId={anonId} questionId={q._id} startOpen={target === q._id} />
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Patterns in the patient&apos;s log</h2>
        <p className="text-xs text-muted">Hypotheses to talk through, with counts. Not conclusions.</p>
        {d.patterns.length === 0 && <p className="text-sm text-muted">Log a few things and patterns will show up here.</p>}
        <ul className="space-y-2">
          {d.patterns.map((p) => (
            <li key={p.item} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              {patternSentence(p)}
            </li>
          ))}
        </ul>
      </section>

      {d.warnings.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Warning signs logged</h2>
          <p className="text-xs text-muted">Dates and the signs named in the patient&apos;s log notes, for the clinician. The notes themselves aren&apos;t shown.</p>
          <ul className="space-y-2">
            {d.warnings.map((w) => (
              <li key={w.at} className="rounded-xl border border-flag bg-flag-soft px-4 py-3 text-sm">
                {warningSentence(w, d.language)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.meds.length > 0 ? (
        <MedReview anonId={anonId} person={personFor(d.role, d.caresFor)} />
      ) : (
        <section>
          <h2 className="font-bold">Medicines and what the labels say</h2>
          <p className="text-sm text-muted">No medicines on file.</p>
        </section>
      )}

      {d.answered.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">Answered</h2>
          {d.answered.map((q) => (
            <div key={q._id} className="rounded-2xl border border-border bg-surface-2 p-4">
              <p className="font-bold">
                {q.text}
                {q.synthetic && <span className="ml-2 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">demo data</span>}
              </p>
              {q.answer && (
                <>
                  <p className="mt-1">
                    <span className="text-xs font-bold uppercase text-muted">{q.answer.professionalType}: </span>
                    {q.answer.text}
                  </p>
                  {q.answer.source === "team_link" && (
                    <p className="mt-1 text-xs font-bold text-info">Recorded through the care-team link (the person with the link, not identity-checked).</p>
                  )}
                  <Outcome anonId={anonId} id={q.answer._id} value={q.answer.resultingChange} />
                  <LogStatus status={q.answer.status} nudge={null} />
                  {q.answer.resultingChange === "formulation_changed" && (
                    <>
                      {q.afterChangeOutcome ? (
                        <p className="mt-2 text-sm">
                          <span className="font-bold">Two weeks on:</span> {OUTCOME_WORD[q.afterChangeOutcome]}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted">
                          {q.followUpDue ? "The two-week check-in is on the home screen." : "Villi will ask how it's going two weeks after the change."}
                        </p>
                      )}
                      <CheckNewForm anonId={anonId} questionId={q._id} initial={q.newFormName} />
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

export default function SheetPage() {
  const anonId = useAnonId();
  if (!anonId) return <Loading />;
  return <Sheet anonId={anonId} />;
}
