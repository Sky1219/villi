"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { friendlyError } from "@/lib/errors";
import { WarningCard } from "@/components/WarningCard";
import { cardFor, scanWarningSigns, type WarningCard as Card } from "@convex/lib/warningSigns";
import { AgainstGuidanceConfirm, useGuidanceCheck } from "@/components/AgainstGuidance";

const OUTCOMES = [
  { value: "helped", label: "Helped" },
  { value: "neutral", label: "No change" },
  { value: "hurt", label: "Worse" },
] as const;

export function LogStatus({ status, nudge }: { status: string; nudge: string | null }) {
  if (status === "checking") return <p className="text-sm text-muted">Checking before it&apos;s shared…</p>;
  if (status === "shared") return <p className="text-sm text-ok">Shared anonymously with people who have the same anatomy.</p>;
  return <p className="text-sm text-muted">{nudge ?? "Kept private to you."}</p>;
}

// One tap logs; the note is optional. Moderation runs on the scheduler.
export function LogCard({
  anonId,
  answerId,
  itemName,
  person = "you",
}: {
  anonId: string;
  answerId: Id<"answers">;
  itemName: string;
  person?: string;
}) {
  const create = useMutation(api.logs.create);
  const mine = useQuery(api.logs.listMine, { anonId });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logged = mine?.find((l) => l.answerId === answerId);
  // Shown from the note the moment it is saved, then from the saved entry until "Got it".
  const [local, setLocal] = useState<Exclude<Card, null> | null>(null);
  const [done, setDone] = useState(false);
  const card = done ? null : (logged?.card ?? local);
  const guidance = useGuidanceCheck(anonId);

  async function save(outcome: (typeof OUTCOMES)[number]["value"]) {
    setBusy(true);
    setError(null);
    setLocal(cardFor(scanWarningSigns(note), outcome, null));
    try {
      await create({ anonId, answerId, outcome, note: note || undefined });
      guidance.clear();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (logged) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="font-bold">
          You logged {itemName}: {OUTCOMES.find((o) => o.value === logged.outcome)?.label.toLowerCase()}
        </p>
        <LogStatus status={logged.status} nudge={logged.nudge} />
        {card && <WarningCard anonId={anonId} card={card} person={person} logId={logged._id} onDone={() => setDone(true)} />}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 id="log-outcome" className="mb-2 font-bold">
        Had it? How did it go?
      </h2>
      {/* The note comes before the outcome: tapping an outcome saves the entry. */}
      <label htmlFor="log-note" className="sr-only">
        Optional note
      </label>
      <input
        id="log-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
        placeholder="Optional note, e.g. output went up after"
        className="mb-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <div role="group" aria-labelledby="log-outcome" className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await guidance.check(o.value, { answerId });
              setBusy(false);
              if (ok) await save(o.value);
            }}
            className="min-h-12 rounded-xl border border-border bg-background px-2 font-bold disabled:opacity-60"
          >
            {o.label}
          </button>
        ))}
      </div>
      {guidance.pending && (
        <AgainstGuidanceConfirm
          pending={guidance.pending}
          person={person}
          busy={busy}
          onSave={() => save(guidance.pending!.outcome)}
          onCancel={guidance.clear}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Shared anonymously, by anatomy only, after a safety check. No names.</p>
    </section>
  );
}
