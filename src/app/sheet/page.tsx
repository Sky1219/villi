"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAnonId } from "@/lib/anon";
import { LogStatus } from "@/components/LogCard";
import { citeText, patternSentence, sheetMarkdown } from "@/lib/sheet";

const PROS = ["pharmacist", "dietitian", "doctor", "nurse"] as const;

function LogAnswer({ anonId, questionId }: { anonId: string; questionId: Id<"questions"> }) {
  const log = useMutation(api.careTeam.logAnswer);
  const [open, setOpen] = useState(false);
  const [pro, setPro] = useState<(typeof PROS)[number]>("pharmacist");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 min-h-11 rounded-xl border border-accent px-3 text-sm font-bold text-accent">
        Log the answer
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await log({ anonId, questionId, professionalType: pro, answerText: text });
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-bold">Who answered?</legend>
        <div className="grid grid-cols-2 gap-2">
          {PROS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPro(p)}
              aria-pressed={pro === p}
              className={`min-h-11 rounded-xl border text-sm capitalize ${pro === p ? "border-accent bg-accent-soft font-bold" : "border-border"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        What they said, in your own words
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          required
          className="mt-1 w-full rounded-xl border border-border bg-background p-3"
        />
      </label>
      <p className="text-xs text-muted">
        Shared anonymously with people who have your anatomy, labeled as your care team&apos;s answer, after a safety
        check. Leave out names and doses.
      </p>
      <button disabled={busy || !text.trim()} className="min-h-12 w-full rounded-xl bg-accent font-bold text-accent-ink disabled:opacity-60">
        Save answer
      </button>
    </form>
  );
}

function Sheet({ anonId }: { anonId: string }) {
  const d = useQuery(api.sheet.get, { anonId });
  const [copied, setCopied] = useState(false);
  if (!d) return <p className="pt-10 text-center text-muted">Loading…</p>;
  const date = new Date().toLocaleDateString(d.language);
  const md = () => sheetMarkdown(d, date);

  async function share() {
    const text = md();
    const file = new File([text], "villi-appointment-sheet.md", { type: "text/markdown" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Appointment sheet" });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([md()], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "villi-appointment-sheet.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="space-y-5 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Appointment sheet</h1>
        <p className="text-sm text-muted">{d.anatomyText}</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/sheet/print" className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-3 text-center font-bold text-accent-ink">
          Print or save PDF
        </Link>
        <button onClick={share} className="min-h-12 rounded-xl border border-accent px-3 font-bold text-accent">
          {copied ? "Copied ✓" : "Share or copy"}
        </button>
        <button onClick={download} className="col-span-2 min-h-11 text-sm font-bold text-accent underline">
          Download as Markdown
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">Questions to ask ({d.open.length})</h2>
        {d.open.length === 0 && <p className="text-muted">No open questions. Add one from any answer&apos;s question card.</p>}
        {d.open.map((q) => (
          <div key={q._id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-bold">{q.text}</p>
            {q.itemName && <p className="text-xs text-muted">about {q.itemName}</p>}
            <LogAnswer anonId={anonId} questionId={q._id} />
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Patterns in your own log</h2>
        <p className="text-xs text-muted">Hypotheses to talk through, with counts. Not conclusions.</p>
        {d.patterns.length === 0 && <p className="text-sm text-muted">Log a few things and patterns will show up here.</p>}
        <ul className="space-y-2">
          {d.patterns.map((p) => (
            <li key={p.item} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              {patternSentence(p)}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Medicines and what the labels say</h2>
        <ul className="space-y-2">
          {d.meds.map((m) => (
            <li key={m._id} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="font-bold">{m.name}</p>
              {m.dosageForm && <p className="text-xs text-muted">{m.dosageForm.toLowerCase()}</p>}
              {m.flags.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {m.flags.map((f) => (
                    <li key={f.text} className="text-flag">
                      ⚑ {f.text}
                      <span className="text-muted">{citeText(f.citation)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">{m.labelChecked ? "No flags in the sections checked." : "Label not checked yet."}</p>
              )}
            </li>
          ))}
          {d.meds.length === 0 && <li className="text-sm text-muted">No medicines on file.</li>}
        </ul>
      </section>

      {d.answered.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">Answered</h2>
          {d.answered.map((q) => (
            <div key={q._id} className="rounded-2xl border border-border bg-surface-2 p-4">
              <p className="font-bold">{q.text}</p>
              {q.answer && (
                <>
                  <p className="mt-1">
                    <span className="text-xs font-bold uppercase text-muted">{q.answer.professionalType}: </span>
                    {q.answer.text}
                  </p>
                  <LogStatus status={q.answer.status} nudge={null} />
                </>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

export default function SheetPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Sheet anonId={anonId} />;
}
