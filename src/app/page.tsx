"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { QuickProfileForm } from "@/components/QuickProfileForm";
import { ScanBox } from "@/components/ScanBox";

function Header() {
  return (
    <header className="pt-6 pb-4">
      <h1 className="text-3xl font-bold tracking-tight">Villi</h1>
      <p className="text-muted">Can a body with this much intestine actually use this?</p>
    </header>
  );
}

function Welcome({ anonId }: { anonId: string }) {
  return (
    <main className="space-y-6">
      <Header />
      <section className="space-y-3">
        <Link
          href="/demo?as=father"
          className="flex min-h-16 flex-col justify-center rounded-2xl bg-accent px-5 py-4 text-accent-ink shadow-sm"
        >
          <span className="text-lg font-bold">See it as my dad</span>
          <span className="text-sm opacity-90">End-jejunostomy, no colon, under 100 cm of small bowel</span>
        </Link>
        <Link
          href="/demo?as=peer"
          className="flex min-h-16 flex-col justify-center rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm"
        >
          <span className="text-lg font-bold">See it as someone with their colon</span>
          <span className="text-sm text-muted">Small bowel joined to colon, 100 to 200 cm</span>
        </Link>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-bold">Or set up your own</h2>
        <QuickProfileForm anonId={anonId} />
      </section>
    </main>
  );
}

function Home({ anonId }: { anonId: string }) {
  const router = useRouter();
  const profile = useQuery(api.profiles.me, { anonId });
  const answers = useQuery(api.answers.listMine, profile ? { anonId } : "skip");
  const questions = useQuery(api.questions.listMine, profile ? { anonId } : "skip");
  const start = useMutation(api.answers.start);
  const [editing, setEditing] = useState(false);

  if (profile === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  if (profile === null) return <Welcome anonId={anonId} />;

  return (
    <main className="space-y-5">
      <Header />
      <section className="rounded-2xl bg-surface-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{profile.role === "caregiver" ? "Checking for someone you care for" : "Your anatomy"}</p>
            <p className="font-bold">{profile.anatomyText}</p>
          </div>
          <button onClick={() => setEditing((e) => !e)} className="min-h-11 shrink-0 text-sm font-bold text-accent underline">
            {editing ? "Close" : "Change"}
          </button>
        </div>
        {editing && (
          <div className="mt-4">
            <QuickProfileForm anonId={anonId} onDone={() => setEditing(false)} />
          </div>
        )}
      </section>

      <ScanBox anonId={anonId} />

      {profile.meds.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Medicines on file</h2>
          <ul className="space-y-2">
            {profile.meds.map((m) => (
              <li key={m._id}>
                <button
                  onClick={async () => {
                    const id = await start({ anonId, text: m.name, category: "pill" });
                    router.push(`/answer/${id}`);
                  }}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-2 text-left"
                >
                  <span>
                    <span className="block font-bold">{m.name}</span>
                    {m.dosageForm && <span className="block text-xs text-muted">{m.dosageForm.toLowerCase()}</span>}
                  </span>
                  <span className="text-sm font-bold text-accent">Check</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answers && answers.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Recent checks</h2>
          <ul className="space-y-2">
            {answers.map((a) => (
              <li key={a._id}>
                <Link href={`/answer/${a._id}`} className="block rounded-xl border border-border bg-surface px-4 py-3">
                  <span className="block font-bold">{a.title}</span>
                  <span className="block text-sm text-muted">{a.verdict ?? a.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {questions && questions.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">For your next appointment</h2>
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q._id} className="rounded-xl border border-border bg-surface px-4 py-3">
                <span className="block">{q.text}</span>
                {q.itemName && <span className="block text-xs text-muted">about {q.itemName}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pt-4 text-xs text-muted">
        Villi flags, cites, and writes the question. It never tells you to start, stop, or change a medicine. Not an
        interaction checker. If you feel dizzy, very thirsty, or your output suddenly rises, contact your care team or
        emergency services.
      </p>
    </main>
  );
}

export default function Page() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Home anonId={anonId} />;
}
