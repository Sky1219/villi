"use client";

import { useId, useState } from "react";
import { friendlyError } from "@/lib/errors";

// "Did you know this already?" on a flag. One tap, changeable; tapping the chosen one clears it.
// The answers feed "New to the person" on "Is Villi working?".
export function KnewBefore({
  value,
  person = "you",
  onPick,
  compact = false,
}: {
  value: boolean | null;
  person?: string;
  onPick: (knew: boolean | null) => Promise<unknown>;
  compact?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const who = person === "you" ? "you" : `you or ${person}`;
  const pick = async (knew: boolean) => {
    setError(null);
    try {
      await onPick(value === knew ? null : knew);
    } catch (e) {
      setError(friendlyError(e));
    }
  };
  const btn = (on: boolean) =>
    `min-h-11 flex-1 rounded-xl border px-3 text-sm font-bold ${on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"}`;
  return (
    <div className={compact ? "mt-3" : "rounded-2xl border border-border bg-surface p-4"}>
      <p id={id} className={compact ? "mb-1 text-sm font-bold" : "mb-2 font-bold"}>
        Did {who} know this already?
      </p>
      <div role="group" aria-labelledby={id} className="flex gap-2">
        <button onClick={() => pick(false)} aria-pressed={value === false} className={btn(value === false)}>
          {person === "you" ? "New to me" : "New to us"}
        </button>
        <button onClick={() => pick(true)} aria-pressed={value === true} className={btn(value === true)}>
          Knew it
        </button>
      </div>
      {value !== null && <p className="mt-2 text-xs text-muted">Thanks. Counted anonymously on &ldquo;Is Villi working?&rdquo;</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </div>
  );
}
