"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { CHANGE_SHORT, citeText, patternSentence } from "@/lib/sheet";
import { preparedBy } from "@convex/lib/careFor";

// Print / Save as PDF: plain layout, selectable text, correct fonts for every script.
function Print({ anonId }: { anonId: string }) {
  const d = useQuery(api.sheet.get, { anonId });
  if (!d) return <p className="pt-10 text-center text-muted">Loading…</p>;
  const date = new Date().toLocaleDateString(d.language);
  return (
    <main className="print-sheet space-y-5 bg-white py-6 text-black">
      <div className="no-print flex gap-2">
        <button onClick={() => window.print()} className="min-h-12 flex-1 rounded-xl bg-accent px-4 font-bold text-accent-ink">
          Print or save as PDF
        </button>
        <button onClick={() => history.back()} className="min-h-12 rounded-xl border border-border px-4 font-bold">
          Back
        </button>
      </div>
      <header>
        <h1 className="text-2xl font-bold">Appointment sheet</h1>
        <p className="text-sm">Patient&apos;s anatomy: {d.anatomyText}.</p>
        <p className="text-sm">
          Prepared with Villi on {date} by {preparedBy(d.role, d.caresFor)}.
        </p>
      </header>
      <section>
        <h2 className="mb-1 text-lg font-bold">Questions to ask</h2>
        <ol className="list-decimal space-y-1 pl-6">
          {d.open.map((q) => (
            <li key={q._id}>
              {q.text}
              {q.itemName && <span className="text-muted"> (about {q.itemName})</span>}
              {q.status === "asked" && <span className="text-muted"> (asked, answer not logged yet)</span>}
              <div className="mt-1 h-10 border-b border-dashed border-neutral-400" aria-label="Space for the answer" />
            </li>
          ))}
          {d.open.length === 0 && <li>(none open)</li>}
        </ol>
      </section>
      <section>
        <h2 className="mb-1 text-lg font-bold">Patterns in the patient&apos;s log</h2>
        <p className="text-sm text-muted">To discuss, not conclusions.</p>
        <ul className="list-disc space-y-1 pl-6">
          {d.patterns.map((p) => (
            <li key={p.item}>{patternSentence(p)}</li>
          ))}
          {d.patterns.length === 0 && <li>Not enough entries yet.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-1 text-lg font-bold">Medicines and what the labels say</h2>
        <ul className="list-disc space-y-1 pl-6">
          {d.meds.map((m) => (
            <li key={m._id}>
              <b>{m.name}</b>
              {m.dosageForm && `: ${m.dosageForm.toLowerCase()}`}
              {m.flags.length > 0
                ? `. Flags: ${m.flags.map((f) => `${f.text}${citeText(f.citation)}`).join("; ")}`
                : m.labelChecked
                  ? ". No flags in the sections checked"
                  : ". Label not checked yet"}
            </li>
          ))}
        </ul>
      </section>
      {d.answered.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-bold">Answered</h2>
          <ul className="list-disc space-y-1 pl-6">
            {d.answered.map((q) => (
              <li key={q._id}>
                {q.text}
                {q.answer && (
                  <div className="text-sm">
                    {q.answer.professionalType}: {q.answer.text}
                    {q.answer.resultingChange && <div>Outcome: {CHANGE_SHORT[q.answer.resultingChange]}</div>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="border-t pt-2 text-xs">
        Villi flags and cites; it does not make treatment decisions. Label text from openFDA, which says not to rely on it
        alone for medical decisions.
      </p>
    </main>
  );
}

export default function PrintPage() {
  const anonId = useAnonId();
  if (!anonId) return null;
  return <Print anonId={anonId} />;
}
