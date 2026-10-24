"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { LINK_CHOICES, preparedBy } from "@convex/lib/careFor";
import { friendlyError } from "@/lib/errors";
import { CHANGE_SHORT, citeText, patternSentence, warningSentence } from "@/lib/sheet";

const PROS = ["pharmacist", "dietitian", "doctor", "nurse"] as const;
type Change = keyof typeof LINK_CHOICES;

function Respond({ token, questionId }: { token: string; questionId: Id<"questions"> }) {
  const respond = useMutation(api.careTeam.linkRespond);
  const [open, setOpen] = useState(false);
  const [pro, setPro] = useState<(typeof PROS)[number]>("pharmacist");
  const [change, setChange] = useState<Change | null>(null);
  const [note, setNote] = useState("");
  const [newForm, setNewForm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 min-h-11 rounded-xl border border-accent px-3 text-sm font-bold text-accent">
        Record what happened
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!change) return;
        setBusy(true);
        setError(null);
        try {
          await respond({
            token,
            questionId,
            professionalType: pro,
            resultingChange: change,
            note: note.trim() || undefined,
            newFormName: change === "formulation_changed" ? newForm.trim() || undefined : undefined,
          });
        } catch (err) {
          setError(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-bold">Your role</legend>
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
      <fieldset>
        <legend className="mb-1 text-sm font-bold">What happened?</legend>
        <div className="grid gap-2">
          {(Object.keys(LINK_CHOICES) as Change[]).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setChange(c)}
              aria-pressed={change === c}
              className={`min-h-11 rounded-xl border px-3 text-left text-sm ${change === c ? "border-accent bg-accent-soft font-bold" : "border-border"}`}
            >
              {LINK_CHOICES[c]}
            </button>
          ))}
        </div>
      </fieldset>
      {change === "formulation_changed" && (
        <label className="block text-sm">
          The new form&apos;s name (optional)
          <input
            value={newForm}
            onChange={(e) => setNewForm(e.target.value)}
            maxLength={80}
            className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"
          />
        </label>
      )}
      <label className="block text-sm">
        A short note for the family (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={280}
          className="mt-1 w-full rounded-xl border border-border bg-background p-3"
        />
      </label>
      <p className="text-xs text-muted">
        This goes to the family who shared the link. Before any of it could be shown to anyone else, it is screened; please
        leave out names and doses.
      </p>
      <button disabled={busy || !change} className="min-h-12 w-full rounded-xl bg-accent font-bold text-accent-ink disabled:opacity-60">
        Save
      </button>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </form>
  );
}

function Team({ token }: { token: string }) {
  const d = useQuery(api.careTeam.linkView, { token });
  if (d === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  if (d.expired) {
    return (
      <main className="space-y-3 pt-10">
        <h1 className="text-2xl font-bold">This link has expired</h1>
        <p className="text-muted">Care-team links last 14 days, and the family can revoke them sooner. Ask them for a new one.</p>
      </main>
    );
  }
  return (
    <main className="space-y-5 pt-4">
      <p className="rounded-2xl border-2 border-accent bg-accent-soft p-4 text-sm font-bold">
        Shared by the patient&apos;s family through Villi. Not a medical record.
      </p>
      <header>
        <h1 className="text-2xl font-bold">Appointment sheet</h1>
        <p className="text-sm text-muted">The patient&apos;s anatomy: {d.anatomyText}.</p>
        <p className="text-sm text-muted">Prepared by {preparedBy(d.role, d.caresFor)}. Link expires {new Date(d.expiresAt).toLocaleDateString()}.</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-bold">Questions from the patient&apos;s family ({d.open.length})</h2>
        {d.open.length === 0 && <p className="text-sm text-muted">No open questions.</p>}
        {d.open.map((q) => (
          <div key={q._id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-bold">{q.text}</p>
            {q.itemName && <p className="text-xs text-muted">about {q.itemName}</p>}
            <Respond token={token} questionId={q._id} />
          </div>
        ))}
      </section>

      {d.warnings.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Warning signs logged</h2>
          <p className="text-xs text-muted">Dates and the signs named in the patient&apos;s log notes. The notes themselves aren&apos;t shown.</p>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            {d.warnings.map((w) => (
              <li key={w.at}>{warningSentence(w)}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">Medicines and what the labels say</h2>
        <ul className="space-y-2">
          {d.meds.map((m) => (
            <li key={m._id} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <p className="font-bold">{m.name}</p>
              {m.dosageForm && <p className="text-xs text-muted">{m.dosageForm.toLowerCase()}</p>}
              {m.flags.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {m.flags.map((f) => (
                    <li key={f.text} className="text-flag">
                      ⚑ {f.text}
                      <span className="text-muted">{citeText(f.citation)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">{m.summary}</p>
              )}
            </li>
          ))}
          {d.meds.length === 0 && <li className="text-sm text-muted">No medicines on file.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Patterns in the patient&apos;s log</h2>
        <p className="text-xs text-muted">Hypotheses from the patient&apos;s own entries, with counts. Not conclusions.</p>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          {d.patterns.map((p) => (
            <li key={p.item}>{patternSentence(p)}</li>
          ))}
          {d.patterns.length === 0 && <li>Not enough entries yet.</li>}
        </ul>
      </section>

      {d.answered.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Already answered</h2>
          <ul className="space-y-2 text-sm">
            {d.answered.map((q) => (
              <li key={q._id} className="rounded-xl bg-surface-2 p-3">
                <p className="font-bold">{q.text}</p>
                {q.answer?.resultingChange && <p>Outcome: {CHANGE_SHORT[q.answer.resultingChange]}</p>}
                {q.answer?.source === "team_link" && <p className="text-xs text-muted">Recorded through this care-team link.</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="border-t border-border pt-2 text-xs text-muted">
        Villi flags and cites; it does not make treatment decisions. Label text comes from openFDA, which says not to rely on
        it alone for decisions about medical care. Whoever holds this link can record answers; Villi does not verify who
        they are.
      </p>
    </main>
  );
}

export default function TeamPage() {
  const { token } = useParams<{ token: string }>();
  return <Team token={token} />;
}
