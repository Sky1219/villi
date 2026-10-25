"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { friendlyError } from "@/lib/errors";

// "Did you get an answer?": shown a few days after "I asked this" until the answer is logged.
export function AnswerNudges({ anonId }: { anonId: string }) {
  const nudges = useQuery(api.questions.answerNudges, { anonId });
  const snooze = useMutation(api.questions.snoozeAnswerNudge);
  const [error, setError] = useState<string | null>(null);
  if (!nudges?.length) return null;
  return (
    <>
      {nudges.map((q) => (
        <section key={q._id} className="rounded-2xl border-2 border-accent bg-accent-soft p-4">
          <h2 className="font-bold">Did you get an answer?</h2>
          <p className="mt-1">
            You asked: <span className="italic">{q.text}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/sheet#answer-${q._id}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-bold text-accent-ink"
            >
              Log what they said
            </Link>
            <button
              onClick={() => snooze({ anonId, questionId: q._id }).catch((e: unknown) => setError(friendlyError(e)))}
              className="min-h-11 rounded-xl border border-border px-4 font-bold"
            >
              Not yet
            </button>
          </div>
        </section>
      ))}
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </>
  );
}
