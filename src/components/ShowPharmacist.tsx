"use client";

import { useRef } from "react";

// At the counter: the one question in large type, to turn the phone around and show.
// It shows only text the answer already has (item, verdict, question), nothing new.
export function ShowPharmacist({ item, verdict, question }: { item: string | null; verdict: string; question: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="mt-2 min-h-12 w-full rounded-xl border border-accent bg-surface px-4 font-bold text-accent"
      >
        Show this to the pharmacist
      </button>
      <dialog
        ref={ref}
        aria-labelledby="show-question"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-background p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">A question for you</p>
          {item && <p className="text-2xl font-bold">{item}</p>}
          <p id="show-question" className="text-3xl font-bold leading-tight">
            {question}
          </p>
          <p className="text-lg">{verdict}</p>
          <p className="text-sm text-muted">
            From Villi, which checks the FDA label and clinical guidelines against this person&apos;s anatomy. It is not
            medical advice and it doesn&apos;t decide: the decision stays with you and their care team.
          </p>
          <form method="dialog" className="mt-auto">
            <button className="min-h-14 w-full rounded-xl bg-accent px-4 text-lg font-bold text-accent-ink">Done</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
