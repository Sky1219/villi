"use client";

import { useConvex } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { GuidanceConflict } from "@convex/lib/guidance";
import { displayName } from "@/lib/displayName";

type Outcome = "helped" | "neutral" | "hurt";

// Before saving "Helped" or "No change" for something Villi flagged for this anatomy:
// ask once, and say where the entry will go. The server keeps it private either way.
export function useGuidanceCheck(anonId: string) {
  const convex = useConvex();
  const [pending, setPending] = useState<{ outcome: Outcome; conflict: GuidanceConflict } | null>(null);
  // Resolves true when the entry can be saved now, false when the person must confirm first.
  async function check(outcome: Outcome, target: { answerId?: Id<"answers">; itemText?: string }) {
    if (outcome === "hurt") return true;
    try {
      const conflict = await convex.query(api.logs.guidanceCheck, { anonId, outcome, ...target });
      if (conflict) {
        setPending({ outcome, conflict });
        return false;
      }
    } catch {
      // Can't ask right now: save, and the server still keeps a flagged item's entry private.
    }
    return true;
  }
  return { pending, check, clear: () => setPending(null) };
}

const OUTCOME_PHRASE: Record<Outcome, string> = { helped: "it helped", neutral: "it made no change", hurt: "it was worse" };

export function AgainstGuidanceConfirm({
  pending,
  person,
  busy,
  onSave,
  onCancel,
}: {
  pending: { outcome: Outcome; conflict: GuidanceConflict };
  person: string;
  busy?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const whose = person === "you" ? "your" : `${person}'s`;
  const { conflict, outcome } = pending;
  return (
    <section role="alertdialog" aria-labelledby="against-title" aria-describedby="against-body" className="mt-3 rounded-2xl border-2 border-flag bg-flag-soft p-4 text-sm">
      <h3 id="against-title" className="font-bold">
        Villi flagged {displayName(conflict.item)} for {whose} anatomy
      </h3>
      {conflict.why && <p className="mt-1 text-muted">{conflict.why}</p>}
      <p id="against-body" className="mt-2">
        Are you sure {OUTCOME_PHRASE[outcome]}? If you save it, it stays in {whose} own log only and isn&apos;t added to what
        people with the same anatomy see.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="min-h-12 rounded-xl border border-accent bg-surface px-3 font-bold text-accent disabled:opacity-60"
        >
          Save privately
        </button>
        <button onClick={onCancel} className="min-h-12 rounded-xl border border-border bg-surface px-3 font-bold">
          Cancel
        </button>
      </div>
    </section>
  );
}
