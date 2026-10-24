"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAnonId } from "@/lib/anon";
import { LogStatus } from "@/components/LogCard";

const PROS = ["pharmacist", "dietitian", "doctor", "nurse"] as const;

function LogAnswer({ anonId, questionId }: { anonId: string; questionId: Id<"questions"> }) {
  const log = useMutation(api.careTeam.logAnswer);
  const [open, setOpen] = useState(false);
  const [pro, setPro] = useState<(typeof PROS)[number]>("pharmacist");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 min-h-11 rounded-xl border border-accent px-3 text-sm font-bold text-accent">
        Log the answer
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await log({ anonId, questionId, professionalType: pro, answerText: text });
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
      <p className="text-xs text-muted">
        Shared anonymously with people who have your anatomy, labeled as your care team&apos;s answer, after a safety
        check. Leave out names and doses.
      </p>
      <button disabled={busy || !text.trim()} className="min-h-12 w-full rounded-xl bg-accent font-bold text-accent-ink disabled:opacity-60">
        Save answer
      </button>
    </form>
  );
}

function Sheet({ anonId }: { anonId: string }) {
  const questions = useQuery(api.questions.listMine, { anonId });
  const answers = useQuery(api.careTeam.mineByQuestion, { anonId });
  if (!questions || !answers) return <p className="pt-10 text-center text-muted">Loading…</p>;
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const open = questions.filter((q) => !q.resolved);
  const done = questions.filter((q) => q.resolved);

  return (
    <main className="space-y-5 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold">Appointment sheet</h1>
      <section className="space-y-3">
        <h2 className="font-bold">Questions to ask ({open.length})</h2>
        {open.length === 0 && <p className="text-muted">No open questions. Add one from any answer&apos;s question card.</p>}
        {open.map((q) => (
          <div key={q._id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-bold">{q.text}</p>
            {q.itemName && <p className="text-xs text-muted">about {q.itemName}</p>}
            <LogAnswer anonId={anonId} questionId={q._id} />
          </div>
        ))}
      </section>
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">Answered</h2>
          {done.map((q) => {
            const a = byQ.get(q._id);
            return (
              <div key={q._id} className="rounded-2xl border border-border bg-surface-2 p-4">
                <p className="font-bold">{q.text}</p>
                {a && (
                  <>
                    <p className="mt-1">
                      <span className="text-xs font-bold uppercase text-muted">{a.professionalType}: </span>
                      {a.answer}
                    </p>
                    <LogStatus status={a.status} nudge={a.nudge} />
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default function SheetPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Sheet anonId={anonId} />;
}
