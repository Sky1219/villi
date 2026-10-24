"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { LogStatus } from "@/components/LogCard";

const OUTCOMES = [
  { value: "helped", label: "Helped" },
  { value: "neutral", label: "No change" },
  { value: "hurt", label: "Worse" },
] as const;

// Item + outcome + optional note in under five seconds.
export function QuickLog({ anonId }: { anonId: string }) {
  const create = useMutation(api.logs.create);
  const mine = useQuery(api.logs.listMine, { anonId });
  const [item, setItem] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function log(outcome: (typeof OUTCOMES)[number]["value"]) {
    if (!item.trim()) {
      setError("What did you have?");
      return;
    }
    setError(null);
    try {
      await create({ anonId, outcome, itemText: item.trim(), note: note.trim() || undefined });
      setItem("");
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-lg font-bold">Log how something went</h2>
      <label htmlFor="quick-item" className="sr-only">
        What you had
      </label>
      <input
        id="quick-item"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        placeholder="What did you have? Any language is fine"
        className="mb-2 min-h-12 w-full rounded-xl border border-border bg-background px-3"
        autoComplete="off"
      />
      <div className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((o) => (
          <button key={o.value} onClick={() => log(o.value)} className="min-h-12 rounded-xl border border-border bg-background font-bold">
            {o.label}
          </button>
        ))}
      </div>
      <label htmlFor="quick-note" className="sr-only">
        Optional note
      </label>
      <input
        id="quick-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
        placeholder="Optional note"
        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
      {error && <p className="mt-2 text-sm text-flag">{error}</p>}

      {mine && mine.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {mine.slice(0, 6).map((l) => (
            <li key={l._id}>
              <p className="text-sm">
                <span className="font-bold">{l.item}</span>: {OUTCOMES.find((o) => o.value === l.outcome)?.label.toLowerCase()}
                {l.note && <span className="text-muted"> · {l.note}</span>}
              </p>
              <LogStatus status={l.status} nudge={l.nudge} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
