"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { friendlyError } from "@/lib/errors";
import { WarningCard } from "@/components/WarningCard";

const OUTCOMES = [
  { value: "helped", label: "Helped" },
  { value: "neutral", label: "No change" },
  { value: "hurt", label: "Worse" },
] as const;

const withoutStrength = (name: string) => name.replace(/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mL)\b/gi, "").trim();

// Two weeks after a form change: "How is it going?", saved as a normal log linked to the question.
export function AfterChangeCards({ anonId, person }: { anonId: string; person: string }) {
  const due = useQuery(api.questions.followUpsDue, { anonId });
  const log = useMutation(api.questions.logAfterChange);
  const [worse, setWorse] = useState<Id<"log_entries"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const whose = person === "you" ? "your" : `${person}'s`;
  return (
    <>
      {worse && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-bold">Worth telling the care team.</p>
          <WarningCard anonId={anonId} card="drink-worse" person={person} logId={worse} onDone={() => setWorse(null)} />
        </section>
      )}
      {(due ?? []).map((q) => (
        <section key={q._id} className="rounded-2xl border border-border bg-surface-2 p-4">
          <h2 className="flex flex-wrap items-center gap-2 font-bold">
            Two weeks on
            {q.synthetic && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-muted">demo data</span>}
          </h2>
          <p id={`after-${q._id}`} className="mb-3">
            It&apos;s been two weeks since {whose} {withoutStrength(q.itemName ?? "medicine")} was changed
            {q.newFormName ? ` (to ${q.newFormName})` : ""}. How is it going?
          </p>
          <div role="group" aria-labelledby={`after-${q._id}`} className="grid grid-cols-3 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={async () => {
                  setError(null);
                  try {
                    const logId = await log({ anonId, questionId: q._id, outcome: o.value });
                    if (o.value === "hurt") setWorse(logId);
                  } catch (e) {
                    setError(friendlyError(e));
                  }
                }}
                className="min-h-12 rounded-xl border border-border bg-background font-bold"
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>
      ))}
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </>
  );
}

// On an answered question whose form changed: name the new form and check it.
export function CheckNewForm({ anonId, questionId, initial }: { anonId: string; questionId: Id<"questions">; initial: string | null }) {
  const router = useRouter();
  const setNewForm = useMutation(api.questions.setNewForm);
  const start = useMutation(api.answers.start);
  const [name, setName] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        try {
          await setNewForm({ anonId, questionId, name });
          const id = await start({ anonId, text: name.trim(), category: "pill", followsQuestionId: questionId });
          router.push(`/answer/${id}`);
        } catch (err) {
          setError(friendlyError(err));
          setBusy(false);
        }
      }}
    >
      <label htmlFor={`newform-${questionId}`} className="block text-sm font-bold">
        What&apos;s the new form called? (optional)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`newform-${questionId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Name as printed on the label"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <button disabled={busy || !name.trim()} className="min-h-11 rounded-xl border border-accent px-3 text-sm font-bold text-accent disabled:opacity-50">
          Check the new form
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </form>
  );
}
