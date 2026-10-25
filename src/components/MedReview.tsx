"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ReviewCitation } from "@convex/lib/medReview";
import { friendlyError } from "@/lib/errors";
import { KnewBefore } from "./KnewBefore";

const STATE = {
  flagged: { tag: "Flag to discuss", cls: "text-flag", box: "border-flag bg-flag-soft" },
  "nothing-found": { tag: "Nothing found in the sources I checked", cls: "text-muted", box: "border-border bg-surface" },
  "cant-tell": { tag: "Can't tell yet", cls: "text-muted", box: "border-border bg-surface-2" },
} as const;

function Chips({ citations }: { citations: ReviewCitation[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const c = citations.find((x) => x.key === open);
  // Two chips, then "+N more": a wall of pills reads as noise, not evidence.
  const shown = all ? citations : citations.slice(0, 2);
  const hidden = citations.length - shown.length;
  return (
    <span className="block">
      <span className="flex flex-wrap gap-x-1">
        {shown.map((x) => (
          <button
            key={x.key}
            onClick={() => setOpen(open === x.key ? null : x.key)}
            aria-expanded={open === x.key}
            aria-label={`Source: ${x.label}`}
            className="flex min-h-11 items-center"
          >
            <span className="inline-flex min-h-8 items-center rounded-full bg-info-soft px-2.5 text-xs font-bold text-info">{x.label}</span>
          </button>
        ))}
        {hidden > 0 && (
          <button onClick={() => setAll(true)} className="flex min-h-11 items-center px-1 text-xs font-bold text-info underline">
            +{hidden} more {hidden === 1 ? "source" : "sources"}
          </button>
        )}
      </span>
      {c && (
        <span className="mt-1 block rounded-xl bg-info-soft p-3 text-sm">
          {c.key.startsWith("G:") ? (
            <>
              <span className="block text-foreground">{c.text}</span>
              <span className="mt-1 block text-xs text-muted">
                Villi&apos;s summary of: {c.source ?? "this source"}
                {c.section ? `, ${c.section}` : ""}.{" "}
                {c.verifiedAgainst
                  ? `Wording checked by Claude against the ${c.verifiedAgainst}; not yet reviewed by a clinician.`
                  : "Not yet checked against the source text or by a clinician."}
              </span>
            </>
          ) : (
            <mark className="bg-transparent text-foreground">&ldquo;{c.text}&rdquo;</mark>
          )}
        </span>
      )}
    </span>
  );
}

function Row({
  anonId,
  row,
  person,
}: {
  anonId: string;
  row: {
    _id: Id<"meds">;
    name: string;
    state: keyof typeof STATE;
    summary: string;
    flags: { kind: string; text: string; citations: ReviewCitation[] }[];
    labelSource: string | null;
    knewBefore: boolean | null;
  };
  person: string;
}) {
  const router = useRouter();
  const start = useMutation(api.answers.start);
  const markKnew = useMutation(api.meds.markKnewBefore);
  const addQuestion = useMutation(api.questions.addFromReview);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = STATE[row.state];
  return (
    <li className={`rounded-2xl border p-4 ${s.box}`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${s.cls}`}>{s.tag}</p>
      <p className="font-bold break-words">{row.name}</p>
      <p className="text-sm text-muted">{row.summary}</p>
      {row.flags.length > 0 && (
        <ul className="mt-2 space-y-2">
          {row.flags.map((f) => (
            <li key={f.kind} className="text-sm">
              <span className="block">{f.text}</span>
              <Chips citations={f.citations} />
            </li>
          ))}
        </ul>
      )}
      {row.labelSource && <p className="mt-1 text-xs text-muted">Label used: {row.labelSource}</p>}
      {row.state === "flagged" && (
        <KnewBefore compact value={row.knewBefore} person={person} onPick={(knew) => markKnew({ anonId, medId: row._id, knew })} />
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={async () => {
            setError(null);
            try {
              const id = await start({ anonId, text: row.name, category: "pill" });
              router.push(`/answer/${id}`);
            } catch (e) {
              setError(friendlyError(e));
            }
          }}
          className="min-h-11 rounded-xl border border-accent px-3 text-sm font-bold text-accent"
        >
          Run full check
        </button>
        <button
          disabled={added}
          onClick={async () => {
            setError(null);
            try {
              await addQuestion({ anonId, medId: row._id });
              setAdded(true);
            } catch (e) {
              setError(friendlyError(e));
            }
          }}
          className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold disabled:opacity-70"
        >
          {added ? "On the sheet ✓" : "Add a question to the sheet"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </li>
  );
}

// One line on home: the full review lives on the appointment sheet.
export function MedReviewSummary({ anonId, person = "you" }: { anonId: string; person?: string }) {
  const rows = useQuery(api.meds.review, { anonId });
  if (!rows || rows.length === 0) return null;
  const whose = person === "you" ? "your" : `${person}'s`;
  const flagged = rows.filter((r) => r.state === "flagged").length;
  const pending = rows.filter((r) => r.state === "cant-tell").length;
  return (
    <Link href="/sheet#med-review" className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">Review of {whose} {rows.length} medicines</span>
        <span className={`block font-bold ${flagged ? "text-flag" : ""}`}>
          {flagged ? `${flagged} of ${rows.length} to discuss` : "Nothing found in the sources I checked"}
        </span>
        {pending > 0 && <span className="block text-sm text-muted">{pending} still being read</span>}
      </span>
      <span aria-hidden className="font-bold text-accent">
        →
      </span>
    </Link>
  );
}

// Instant first pass over every medicine on file, from the cached FDA label and fixed guideline mappings.
export function MedReview({ anonId, person = "you" }: { anonId: string; person?: string }) {
  const rows = useQuery(api.meds.review, { anonId });
  if (!rows || rows.length === 0) return null;
  const whose = person === "you" ? "your" : `${person}'s`;
  return (
    <section id="med-review" className="scroll-mt-4">
      <h2 className="font-bold">Medicine list review</h2>
      <p className="mb-2 text-sm text-muted">
        An instant first pass over {whose} medicines, from the FDA label and the guidelines. It doesn&apos;t decide anything;
        a full check goes further.
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <Row key={r._id} anonId={anonId} row={r} person={person} />
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        FDA label text via openFDA, which says not to rely on it alone for decisions about medical care.
      </p>
    </section>
  );
}
