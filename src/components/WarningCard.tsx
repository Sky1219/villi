"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DEHYDRATION_CHUNK, cardText, type WarningCard as Card } from "@convex/lib/warningSigns";
import { friendlyError } from "@/lib/errors";

// Shown the moment a log is saved with warning signs in its note (or a "worse"
// drink), and kept until the author taps "Got it". No advice beyond the card.
export function WarningCard({
  anonId,
  card,
  person,
  logId,
  onDone,
}: {
  anonId: string;
  card: Exclude<Card, null>;
  person: string;
  logId: Id<"log_entries"> | null;
  onDone: () => void;
}) {
  const ack = useMutation(api.logs.ackWarning);
  const chunks = useQuery(api.questions.citationsFor, card === "emergency" ? "skip" : { anonId, chunkIds: [DEHYDRATION_CHUNK] });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urgent = card !== "drink-worse";
  const src = chunks?.[0];
  return (
    <section role="alert" className={`mt-3 rounded-2xl p-4 text-sm ${urgent ? "border-2 border-flag bg-flag-soft" : "border border-border bg-surface-2"}`}>
      {card === "emergency" && <h3 className="font-bold text-flag">Call for help now if needed</h3>}
      <p className={urgent ? "font-bold" : ""}>{cardText(card, person)}</p>
      {src && (
        <>
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Source: UOAA 2025" className="flex min-h-11 items-center">
            <span className="inline-flex min-h-8 items-center rounded-full bg-info-soft px-2.5 text-xs font-bold text-info">UOAA 2025</span>
          </button>
          {open && (
            <span className="block rounded-xl bg-info-soft p-3">
              <span className="block">{src.text}</span>
              <span className="mt-1 block text-xs text-muted">
                Villi&apos;s summary of: {src.sourceTitle}
                {src.section ? `, ${src.section}` : ""}.
              </span>
            </span>
          )}
        </>
      )}
      <button
        onClick={async () => {
          setError(null);
          try {
            if (logId) await ack({ anonId, logId });
            onDone();
          } catch (e) {
            setError(friendlyError(e));
          }
        }}
        className="mt-2 min-h-11 w-full rounded-xl border border-foreground/30 bg-background px-3 font-bold"
      >
        Got it
      </button>
      {error && <p className="mt-2 text-flag">{error}</p>}
    </section>
  );
}
