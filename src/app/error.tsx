"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 pt-20 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted">Nothing you entered was shared. Try again, or go back home.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="min-h-12 rounded-xl bg-accent px-5 font-bold text-accent-ink">
          Try again
        </button>
        <Link href="/" className="flex min-h-12 items-center rounded-xl border border-border px-5 font-bold">
          Home
        </Link>
      </div>
    </main>
  );
}
