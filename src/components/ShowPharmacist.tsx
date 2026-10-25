"use client";

import { useEffect, useId, useRef } from "react";

type Shown = { item: string | null; question: string; verdict?: string };

// At the counter: the questions in large type, to turn the phone around and show.
// It shows only text Villi already has (item, verdict, question), nothing new.
export function ShowPharmacist({ questions, label = "Show this to the pharmacist" }: { questions: Shown[]; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // If the dialog unmounts while open (back gesture, or the last question gets answered
  // live), onClose never fires: release the scroll lock anyway.
  useEffect(() => () => {
    document.documentElement.style.overflow = "";
  }, []);
  if (questions.length === 0) return null;
  const many = questions.length > 1;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          // The page behind a full-screen dialog shouldn't scroll (iOS lets it).
          document.documentElement.style.overflow = "hidden";
          ref.current?.showModal();
        }}
        className="mt-2 min-h-12 w-full rounded-xl border border-accent bg-surface px-4 font-bold text-accent"
      >
        {label}
      </button>
      <dialog
        ref={ref}
        onClose={() => {
          document.documentElement.style.overflow = "";
        }}
        aria-labelledby={titleId}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-background p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-4">
          {/* First focusable element, so the dialog opens at the top, not scrolled to Done. */}
          <div className="flex items-center justify-between gap-3">
            <p id={titleId} className="text-sm font-bold uppercase tracking-wide text-accent">
              {many ? `${questions.length} questions for you` : "A question for you"}
            </p>
            <form method="dialog">
              <button className="min-h-11 px-2 text-sm font-bold text-accent underline">Close</button>
            </form>
          </div>
          <ol className="space-y-8">
            {questions.map((q, i) => (
              <li key={i} className="space-y-3">
                {q.item && (
                  <p className="text-2xl font-bold">
                    {many && `${i + 1}. `}
                    {q.item}
                  </p>
                )}
                <p className="text-3xl font-bold leading-tight">{q.question}</p>
                {q.verdict && <p className="text-lg">{q.verdict}</p>}
              </li>
            ))}
          </ol>
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
