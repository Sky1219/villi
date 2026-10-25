"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { citationLabel } from "@/lib/citations";
import { Loading } from "@/components/Loading";

// The fridge sheet: printable on US letter. Guideline lines in Villi's words, drinks people
// with the same anatomy logged as fine, never an amount.
function Fridge({ anonId }: { anonId: string }) {
  const d = useQuery(api.fridge.get, { anonId });
  if (!d) return <Loading />;
  const whose = d.role === "caregiver" ? "their" : "my";
  return (
    <main className="print-sheet space-y-4 bg-white py-6 text-black print:py-0">
      <div className="no-print flex gap-2">
        <button onClick={() => window.print()} className="min-h-12 flex-1 rounded-xl bg-accent px-4 font-bold text-accent-ink">
          Print or save as PDF
        </button>
        <button onClick={() => history.back()} className="min-h-12 rounded-xl border border-border px-4 font-bold">
          Back
        </button>
      </div>
      <header>
        <h1 className="text-2xl font-bold">Drinks that work for {whose} anatomy</h1>
        <p className="mt-1">
          {d.anatomyText}
          {!d.anatomyConfirmed && " (not confirmed yet: this assumes the most cautious case)"}.
        </p>
      </header>

      {d.sections.map((s) => (
        <section key={s.key} className="break-inside-avoid">
          <h2 className="mb-1 text-lg font-bold">{s.title}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {s.lines.map((l) => (
              <li key={l.chunkId}>
                {l.text}{" "}
                <span className="text-sm text-neutral-600">
                  (Villi&apos;s summary of {citationLabel("G", l.chunkId)}
                  {l.section ? `, ${l.section}` : ""})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="break-inside-avoid">
        <h2 className="mb-1 flex flex-wrap items-center gap-2 text-lg font-bold">
          What people with this anatomy logged as fine
          {d.synthetic && <span className="rounded-full border border-neutral-400 px-2.5 py-0.5 text-xs font-bold">demo data</span>}
        </h2>
        {d.community.length === 0 ? (
          <p>Not enough reports yet from people with this anatomy.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {d.community.map((c) => (
              <li key={c.name}>
                <span className="capitalize">{c.name}</span>: {c.tolerated} of {c.total} people logged no problems
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-sm text-neutral-600">
          Self-reported, not a trial, and only drinks that pass the guideline check for this anatomy. Evidence to discuss, not a
          recommendation.
        </p>
      </section>

      <section className="break-inside-avoid rounded-xl border-2 border-black p-3">
        <p className="font-bold">{d.ask}</p>
      </section>

      <p className="border-t pt-2 text-xs text-neutral-700">
        Villi flags and cites; it makes no treatment decisions and gives no amounts. Ask the care team before changing what you
        drink.
      </p>
    </main>
  );
}

export default function FridgePage() {
  const anonId = useAnonId();
  if (!anonId) return null;
  return <Fridge anonId={anonId} />;
}
