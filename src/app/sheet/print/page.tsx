"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { REQUEST_FOOTER, REQUEST_TITLE, anatomyLine, excerpt, flaggedWord, guidelineCite, labelRepeats, warningSentence } from "@/lib/sheet";
import { preparedBy } from "@convex/lib/careFor";

// Print / Save as PDF: the one-page medication review request. Plain layout,
// selectable text, letter size; every flag carries its label sentence and its guideline.
function Print({ anonId }: { anonId: string }) {
  const d = useQuery(api.sheet.get, { anonId });
  if (!d) return <p className="pt-10 text-center text-muted">Loading…</p>;
  const date = new Date().toLocaleDateString(d.language);
  const flagged = d.meds.filter((m) => m.question);
  const clear = d.meds.filter((m) => !m.question && m.labelChecked);
  const unchecked = d.meds.filter((m) => !m.question && !m.labelChecked);
  // Each guideline line prints once; later flags citing it point back to it.
  const firstUse = new Map<string, string>();
  for (const m of flagged) for (const f of m.requestFlags) if (f.guideline && !firstUse.has(f.guideline.key)) firstUse.set(f.guideline.key, `${m._id}:${f.text}`);
  return (
    <main className="print-sheet space-y-3 bg-white py-6 print:py-0 text-[13px] leading-snug text-black">
      <div className="no-print flex gap-2">
        <button onClick={() => window.print()} className="min-h-12 flex-1 rounded-xl bg-accent px-4 font-bold text-accent-ink">
          Print or save as PDF
        </button>
        <button onClick={() => history.back()} className="min-h-12 rounded-xl border border-border px-4 font-bold">
          Back
        </button>
      </div>
      <header>
        <h1 className="text-xl font-bold">{REQUEST_TITLE}</h1>
        <p>
          For the pharmacist. Prepared with Villi on {date} by {preparedBy(d.role, d.caresFor)}.
        </p>
        <p className="mt-1">
          <b>Anatomy:</b> {anatomyLine(d)}.
        </p>
      </header>

      <section>
        <h2 className="mb-1 text-base font-bold">Medicines to review ({flagged.length})</h2>
        {flagged.length === 0 && <p>No flags in the label sections checked.</p>}
        <ol className="space-y-2">
          {flagged.map((m, i) => (
            <li key={m._id} className="break-inside-avoid">
              <p className="font-bold">
                {i + 1}. {m.name}
                {m.dosageForm && <span className="font-normal"> ({m.dosageForm.toLowerCase()})</span>}
              </p>
              <ul className="mt-0.5 list-disc pl-5">
                {m.requestFlags.map((f) => (
                  <li key={f.text}>
                    {f.text}
                    {f.label && labelRepeats(f.text, f.label.text) && <span className="text-neutral-600"> ({f.label.source})</span>}
                    {f.label && !labelRepeats(f.text, f.label.text) && (
                      <div>
                        Label: &ldquo;{excerpt(f.label.text, 260, flaggedWord(f.text))}&rdquo;{" "}
                        <span className="text-neutral-600">({f.label.source})</span>
                      </div>
                    )}
                    {f.guideline && firstUse.get(f.guideline.key) === `${m._id}:${f.text}` && (
                      <div>
                        Guidance: {excerpt(f.guideline.text, 300)} <span className="text-neutral-600">({guidelineCite(f.guideline)})</span>
                      </div>
                    )}
                    {f.guideline && firstUse.get(f.guideline.key) !== `${m._id}:${f.text}` && (
                      <span className="text-neutral-600"> Guidance as above ({guidelineCite(f.guideline)}).</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                <b>Question:</b> {m.question}
              </p>
            </li>
          ))}
        </ol>
        {clear.length > 0 && <p className="mt-2">No flags in the label sections checked: {clear.map((m) => m.name).join(", ")}.</p>}
        {unchecked.length > 0 && <p>Label not checked yet: {unchecked.map((m) => m.name).join(", ")}.</p>}
      </section>

      {d.warnings.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mb-1 text-base font-bold">Warning signs logged</h2>
          <ul className="list-disc pl-5">
            {d.warnings.slice(0, 5).map((w) => (
              <li key={w.at}>{warningSentence(w, d.language)}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="mb-1 text-base font-bold">Other open questions</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {d.open.map((q) => (
            <li key={q._id}>
              {q.text}
              {q.itemName && <span className="text-neutral-600"> (about {q.itemName})</span>}
              {q.status === "asked" && <span className="text-neutral-600"> (asked, answer not logged yet)</span>}
            </li>
          ))}
          {d.open.length === 0 && <li>(none)</li>}
        </ol>
      </section>

      <p className="border-t pt-2 text-[11px] text-neutral-700">{REQUEST_FOOTER}</p>
    </main>
  );
}

export default function PrintPage() {
  const anonId = useAnonId();
  if (!anonId) return null;
  return <Print anonId={anonId} />;
}
