"use client";

import { friendlyError } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { LogStatus } from "@/components/LogCard";
import { WarningCard } from "@/components/WarningCard";
import type { Id } from "@convex/_generated/dataModel";
import { cardFor, scanWarningSigns, type WarningCard as Card } from "@convex/lib/warningSigns";

const OUTCOMES = [
  { value: "helped", label: "Helped" },
  { value: "neutral", label: "No change" },
  { value: "hurt", label: "Worse" },
] as const;

// Item + outcome + optional note in under five seconds.
export function QuickLog({ anonId, person = "you" }: { anonId: string; person?: string }) {
  const create = useMutation(api.logs.create);
  const mine = useQuery(api.logs.listMine, { anonId });
  const [item, setItem] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Shown right away from the note, before the server answers; then from the saved entry.
  const [local, setLocal] = useState<{ card: Exclude<Card, null>; logId: Id<"log_entries"> | null } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const saved = mine?.find((l) => l.card && l._id !== dismissed);
  const shown = local ?? (saved?.card ? { card: saved.card, logId: saved._id } : null);

  async function log(outcome: (typeof OUTCOMES)[number]["value"]) {
    if (!item.trim()) {
      setError("What did you have?");
      return;
    }
    setError(null);
    const card = cardFor(scanWarningSigns(note), outcome, null);
    if (card) setLocal({ card, logId: null });
    try {
      const logId = await create({ anonId, outcome, itemText: item.trim(), note: note.trim() || undefined });
      if (card) setLocal({ card, logId });
      setItem("");
      setNote("");
    } catch (e) {
      setLocal(null);
      setError(friendlyError(e));
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-lg font-bold">Log how something went{person === "you" ? "" : ` for ${person}`}</h2>
      <label htmlFor="quick-item" className="sr-only">
        What you had
      </label>
      <input
        id="quick-item"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder={person === "you" ? "What did you have?" : "What did they have?"}
        className="mb-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
        autoComplete="off"
      />
      {/* The note comes before the outcome: tapping an outcome saves the entry. */}
      <label htmlFor="quick-note" className="sr-only">
        Optional note
      </label>
      <input
        id="quick-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
        placeholder="Optional note"
        className="mb-3 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      <p id="quick-outcome" className="mb-2 text-sm font-bold">
        How did it go?
      </p>
      <div role="group" aria-labelledby="quick-outcome" className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((o) => (
          <button key={o.value} onClick={() => log(o.value)} className="min-h-12 rounded-xl border border-border bg-background font-bold">
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
      {shown && (
        <WarningCard
          anonId={anonId}
          card={shown.card}
          person={person}
          logId={shown.logId}
          onDone={() => {
            setDismissed(shown.logId);
            setLocal(null);
          }}
        />
      )}

      {mine && mine.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {mine.slice(0, 3).map((l) => (
            <li key={l._id}>
              <p className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{l.item}</span>: {OUTCOMES.find((o) => o.value === l.outcome)?.label.toLowerCase()}
                  {l.note && <span className="text-muted"> · {l.note}</span>}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    l.status === "shared" ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted"
                  }`}
                >
                  {l.status === "shared" ? "shared" : l.status === "checking" ? "checking…" : "private"}
                </span>
              </p>
              {/* A private entry always explains why. */}
              {l.status === "private" && <LogStatus status={l.status} nudge={l.nudge} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
