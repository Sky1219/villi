"use client";

import { useEffect, useState } from "react";

type Phase = "now" | "done" | "later";

// The three steps between a question and an answer, as the answer row's status shows them.
// The code check runs at the end of the agent's turn, so it is done once review starts.
export function waitPhases(status: string): Phase[] {
  return status === "reviewing" ? ["done", "done", "now"] : ["now", "later", "later"];
}

const STEPS = [
  "Claude gathers sources with its tools",
  "Code checks every citation, count and dose",
  "A second Claude reviews it against the sources",
];

export function elapsedLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Shown under the live trace while a check runs. Deliberately outside the trace's
// aria-live region, so the ticking clock isn't read out every second.
export function WaitNote({ status, startedAt }: { status: string; startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const elapsed = now - startedAt;
  const phases = waitPhases(status);
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
      <p>
        <span className="font-bold tabular-nums">{elapsedLabel(elapsed)}</span>{" "}
        <span className="text-muted">
          {elapsed > 60_000
            ? "· taking longer than usual. It keeps going if you leave; it will be in Recent checks."
            : "· usually 20 to 55 seconds"}
        </span>
      </p>
      <ol className="space-y-1">
        {STEPS.map((step, i) => (
          <li key={step} className={`flex gap-2 ${phases[i] === "later" ? "text-muted" : ""}`}>
            <span aria-hidden className="w-4 shrink-0 text-center">
              {phases[i] === "done" ? <span className="text-ok">✓</span> : phases[i] === "now" ? "•" : i + 1}
            </span>
            <span className={phases[i] === "now" ? "font-bold" : ""}>
              {step}
              <span className="sr-only">{phases[i] === "done" ? " (done)" : phases[i] === "now" ? " (in progress)" : ""}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-muted">Nothing is shown until both checks pass.</p>
    </section>
  );
}
