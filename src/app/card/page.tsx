"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { Loading } from "@/components/Loading";
import { anatomyLine } from "@/lib/sheet";
import { CARD_QUESTION, cardLine, cardMeds } from "@/lib/card";

// A card to cut out and carry, for the prescriber or pharmacist who doesn't know this anatomy:
// an ER doctor, a new specialist. Same deterministic medicine list review as the sheet.
function Card({ anonId }: { anonId: string }) {
  const d = useQuery(api.sheet.get, { anonId });
  if (!d) return <Loading />;
  const date = new Date().toLocaleDateString(d.language);
  return (
    <main className="print-sheet space-y-4 bg-white py-6 text-black print:py-0">
      <div className="no-print space-y-2">
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="min-h-12 flex-1 rounded-xl bg-accent px-4 font-bold text-accent-ink">
            Print or save as PDF
          </button>
          <Link href="/sheet" className="flex min-h-12 items-center rounded-xl border border-border px-4 font-bold">
            Back
          </Link>
        </div>
        <p className="text-sm">Print it and cut along the dashed line to carry it, or keep it on the phone.</p>
      </div>
      <section className="break-inside-avoid space-y-2 rounded-xl border-2 border-dashed border-black p-4 text-sm print:w-[4in]">
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold">
          Medicine card
          {d.demo && <span className="rounded-full border border-neutral-400 px-2.5 py-0.5 text-xs font-bold">demo data</span>}
        </h1>
        <p>
          <b>Anatomy:</b> {anatomyLine(d)}.
        </p>
        <div>
          <h2 className="font-bold">Medicines on file</h2>
          {d.meds.length === 0 ? (
            <p>None added yet.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              {cardMeds(d.meds).map((m) => (
                <li key={m._id}>
                  <span className="font-bold">{m.name}</span>: {cardLine(m)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="rounded-lg border border-black p-2">
          <b>Question for any prescriber or pharmacist:</b> {CARD_QUESTION}
        </p>
        <p className="text-xs text-neutral-700">
          Prepared with Villi on {date} from FDA labels and clinical guidelines. Not a medical record and not medical advice;
          medicines change, so check it is current.
        </p>
      </section>
    </main>
  );
}

export default function CardPage() {
  const anonId = useAnonId();
  if (!anonId) return null;
  return <Card anonId={anonId} />;
}
