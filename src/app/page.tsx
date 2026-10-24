"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { GutDiagram } from "@/components/GutDiagram";
import { MedsEditor } from "@/components/MedsEditor";
import { MedReview } from "@/components/MedReview";
import { QuickLog } from "@/components/QuickLog";
import { DeleteMyData } from "@/components/DeleteMyData";
import { ScanBox } from "@/components/ScanBox";
import { useState } from "react";
import { stripCitations } from "@/lib/citations";
import { personFor } from "@convex/lib/careFor";

function Header() {
  return (
    <header className="pt-6 pb-4">
      <h1 className="text-3xl font-bold tracking-tight">Villi</h1>
      <p className="text-muted">Can a body with this much intestine actually use this?</p>
    </header>
  );
}

function Welcome() {
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
      <Link
        href="/onboarding"
        className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-accent px-5 py-3 text-lg font-bold text-accent"
      >
        Set up your own (about a minute)
      </Link>
      <p className="text-sm text-muted">No name, no birthday, no medical history. Only coarse anatomy, tied to a random id on this device.</p>
    </main>
  );
}

const STATE_TAG: Record<string, { label: string; cls: string }> = {
  flagged: { label: "Flag to discuss", cls: "text-flag" },
  "nothing-found": { label: "Nothing found in the sources I checked", cls: "text-muted" },
  "cant-tell": { label: "Can't tell yet", cls: "text-muted" },
};

const STATUS_TAG: Record<string, string> = {
  queued: "Checking…",
  running: "Checking…",
  reviewing: "Safety review in progress…",
  blocked: "Didn't pass the safety check",
  failed: "Something went wrong",
};

type RecentCheck = { _id: string; title: string; status: string; verdict: string | null; state?: string | null };

function RecentChecks({ answers }: { answers: RecentCheck[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? answers : answers.slice(0, 5);
  return (
    <section>
      <h2 className="mb-2 font-bold">Recent checks</h2>
      <ul className="space-y-2">
        {shown.map((a) => {
          const tag = a.state ? STATE_TAG[a.state] : undefined;
          return (
            <li key={a._id}>
              <Link href={`/answer/${a._id}`} className="block rounded-xl border border-border bg-surface px-4 py-3">
                <span className={`block text-xs font-bold uppercase tracking-wide ${tag?.cls ?? "text-muted"}`}>
                  {tag?.label ?? STATUS_TAG[a.status] ?? "Answer"}
                </span>
                <span className="block font-bold">{a.title}</span>
                {a.verdict && <span className="line-clamp-2 text-sm text-muted">{stripCitations(a.verdict)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {answers.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} className="mt-1 min-h-11 text-sm font-bold text-accent underline">
          {showAll ? "Show fewer" : `Show all ${answers.length}`}
        </button>
      )}
    </section>
  );
}

function HelpNow() {
  return (
    <section className="rounded-2xl border-2 border-flag bg-flag-soft p-4 text-sm">
      <h2 className="font-bold text-flag">Get help now if</h2>
      <p>
        you feel dizzy or faint, are very thirsty, are passing much less or darker urine, or your output suddenly rises.
        Contact your care team, or emergency services if it&apos;s severe.
      </p>
    </section>
  );
}

function Home({ anonId }: { anonId: string }) {
  const profile = useQuery(api.profiles.me, { anonId });
  const answers = useQuery(api.answers.listMine, profile ? { anonId } : "skip");
  const questions = useQuery(api.questions.listMine, profile ? { anonId } : "skip");

  // "Not right? Type the name instead" lands here with the read name to correct.
  const prefill = typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("q") ?? "");
  if (profile === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  if (profile === null) return <Welcome />;

  return (
    <main className="space-y-5">
      <Header />
      <section className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
        <GutDiagram
          size="badge"
          removed={profile.diagram.removed}
          stoma={profile.diagram.stomaAfter ? { afterSegment: profile.diagram.stomaAfter } : null}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{profile.role === "caregiver" ? `Checking for ${personFor(profile.role, profile.caresFor)}` : "Your anatomy"}</p>
          <p className="font-bold">{profile.anatomyText}</p>
        </div>
        <Link href="/onboarding" className="flex min-h-11 shrink-0 items-center text-sm font-bold text-accent underline">
          Change
        </Link>
      </section>

      <nav className="grid grid-cols-2 gap-2">
        <Link href="/community" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
          Community
        </Link>
        <Link href="/sheet" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
          Your sheet{questions && questions.filter((q) => q.status !== "answered").length ? ` (${questions.filter((q) => q.status !== "answered").length})` : ""}
        </Link>
        <Link href="/impact" className="col-span-2 flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
          Is Villi working?
        </Link>
      </nav>

      <ScanBox anonId={anonId} initialText={prefill} />

      <Link href="/saw" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
        I saw something (a tablet came through)
      </Link>

      <HelpNow />

      <QuickLog anonId={anonId} person={personFor(profile.role, profile.caresFor)} />

      <section>
        <h2 className="mb-2 font-bold">Medicines on file</h2>
        <MedsEditor anonId={anonId} meds={profile.meds} checkable />
      </section>

      <MedReview anonId={anonId} person={personFor(profile.role, profile.caresFor)} />

      {answers && answers.length > 0 && <RecentChecks answers={answers} />}

      <footer className="space-y-2 pt-2 text-xs text-muted">
        <p>
          Villi flags, cites, and writes the question. It never tells you to start, stop, or change a medicine. It
          isn&apos;t an interaction checker: it can&apos;t tell you whether two medicines are safe together.
        </p>
        <p>
          Privacy: no names, birthdays or medical history. Your setup lives under a random id on this device; anything
          shared is anonymous, by anatomy only, and screened first. Photos are deleted after reading.
        </p>
        <DeleteMyData anonId={anonId} />
      </footer>
    </main>
  );
}

export default function Page() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Home anonId={anonId} />;
}
