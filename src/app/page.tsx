"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";
import { GutDiagram } from "@/components/GutDiagram";
import { MedsEditor } from "@/components/MedsEditor";
import { MedReviewSummary } from "@/components/MedReview";
import { AfterChangeCards } from "@/components/AfterChange";
import { AnswerNudges } from "@/components/AnswerNudges";
import { DeviceLinks, EnterDeviceCode } from "@/components/DeviceLinks";
import { QuickLog } from "@/components/QuickLog";
import { DeleteMyData } from "@/components/DeleteMyData";
import { ScanBox } from "@/components/ScanBox";
import { useState } from "react";
import { stripCitations } from "@/lib/citations";
import { personFor } from "@convex/lib/careFor";
import { Loading } from "@/components/Loading";
import { displayName } from "@/lib/displayName";

function Header() {
  return (
    <header className="pt-6 pb-4">
      <h1 className="text-3xl font-bold tracking-tight">Villi</h1>
      <p className="text-muted">Can a body with this much intestine actually use this?</p>
    </header>
  );
}

// The two numbers behind Villi, each linked to its row on the sources page.
const PROBLEM = [
  {
    figure: "29 of 37",
    text: "drugs studied in short bowel syndrome were absorbed less; 6 lost their effect.",
    source: "Hong 2021, systematic review",
    href: "/sources#hong-2021%23absorption-findings",
  },
  {
    figure: "Over 60%",
    text: "of ostomy patients interviewed said they lacked information that medicine can pass through undissolved.",
    source: "Remane 2025, 50 patients",
    href: "/sources#remane-2025%23patient-education",
  },
];

function Welcome({ anonId }: { anonId: string }) {
  return (
    <main className="space-y-6">
      <Header />
      <section aria-labelledby="why" className="space-y-3">
        <h2 id="why" className="sr-only">
          Why Villi exists
        </h2>
        <p>
          For people living with short bowel syndrome or an ostomy, and the family who manage their medicines. A pill
          built to release slowly may pass through a short gut before it works.
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {PROBLEM.map((p) => (
            <li key={p.figure} className="flex flex-col rounded-2xl bg-surface-2 p-3">
              <span className="text-2xl font-bold">{p.figure}</span>
              <span className="text-sm">{p.text}</span>
              <Link href={p.href} className="mt-auto inline-flex min-h-11 items-center text-xs font-bold text-accent underline">
                {p.source}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="try" className="space-y-3">
        <h2 id="try" className="font-bold">
          Try it with a demo profile
        </h2>
        <Link
          href="/demo?as=father"
          className="flex min-h-16 flex-col justify-center rounded-2xl bg-accent px-5 py-4 text-accent-ink shadow-sm"
        >
          <span className="text-lg font-bold">Demo: the builder&apos;s dad</span>
          <span className="text-sm opacity-90">No colon, under 100 cm of small bowel, end-jejunostomy. 5 medicines on file.</span>
        </Link>
        <Link
          href="/demo?as=peer"
          className="flex min-h-16 flex-col justify-center rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm"
        >
          <span className="text-lg font-bold">Demo: someone with their colon</span>
          <span className="text-sm text-muted">Small bowel joined to the colon, 100 to 200 cm</span>
        </Link>
      </section>
      <Link
        href="/onboarding"
        className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-accent px-5 py-3 text-lg font-bold text-accent"
      >
        Set up your own (about a minute)
      </Link>
      <p className="text-sm text-muted">
        Check a medicine or drink for that anatomy and get a cited answer with one question for the pharmacist. Demo
        profiles never count as real use.
      </p>
      <p className="text-sm text-muted">
        Built by a family caregiver whose dad lost his whole large intestine and most of his small intestine. Nobody told
        them his heart medicine was extended-release.
      </p>
      <EnterDeviceCode anonId={anonId} />
      <p className="text-sm text-muted">No name, no birthday, no medical history. Only coarse anatomy, tied to a random id on this device.</p>
      <p className="text-sm text-muted">Villi is not medical advice. It cites its sources and writes one question for your pharmacist or doctor.</p>
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
                <span className="block font-bold">{displayName(a.title)}</span>
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
  if (profile === undefined) return <Loading />;
  if (profile === null) return <Welcome anonId={anonId} />;
  const person = personFor(profile.role, profile.caresFor);
  const openQuestions = questions?.filter((q) => q.status !== "answered").length ?? 0;

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
          <p className="text-sm text-muted">{profile.role === "caregiver" ? `Checking for ${person}` : "Your anatomy"}</p>
          <p className="font-bold">{profile.anatomyText}</p>
        </div>
        <Link href="/onboarding" className="flex min-h-11 shrink-0 items-center text-sm font-bold text-accent underline">
          Change
        </Link>
      </section>

      <ScanBox anonId={anonId} initialText={prefill} />

      {answers && answers.length > 0 && <RecentChecks answers={answers} />}

      <AnswerNudges anonId={anonId} />
      <AfterChangeCards anonId={anonId} person={person} />

      <MedReviewSummary anonId={anonId} person={person} />

      <nav className="grid grid-cols-2 gap-2">
        <Link href="/sheet" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
          Your sheet{openQuestions ? ` (${openQuestions})` : ""}
        </Link>
        <Link href="/community" className="flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
          Community
        </Link>
        <Link href="/saw" className="col-span-2 flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface font-bold">
          I saw something (a tablet came through)
        </Link>
      </nav>

      <HelpNow />

      <QuickLog anonId={anonId} person={person} />

      <section>
        <h2 className="mb-2 font-bold">Medicines on file</h2>
        <MedsEditor anonId={anonId} meds={profile.meds} checkable />
      </section>

      <DeviceLinks anonId={anonId} />

      <footer className="space-y-2 pt-2 text-xs text-muted">
        <p className="font-bold text-foreground">Villi is not medical advice.</p>
        <p>
          Villi flags, cites, and writes the question. It never tells you to start, stop, or change a medicine. It
          isn&apos;t an interaction checker: it can&apos;t tell you whether two medicines are safe together.
        </p>
        <p>
          Privacy: no names, birthdays or medical history. Your setup lives under a random id on this device; anything
          shared is anonymous, by anatomy only, and screened first. Photos are deleted after reading.
        </p>
        <p className="flex flex-wrap gap-x-4">
          <Link href="/how" className="inline-flex min-h-11 items-center font-bold text-accent underline">
            How Villi decides
          </Link>
          <Link href="/sources" className="inline-flex min-h-11 items-center font-bold text-accent underline">
            Sources
          </Link>
          <Link href="/impact" className="inline-flex min-h-11 items-center font-bold text-accent underline">
            Is Villi working?
          </Link>
        </p>
        <DeleteMyData anonId={anonId} />
      </footer>
    </main>
  );
}

export default function Page() {
  const anonId = useAnonId();
  if (!anonId) return <Loading />;
  return <Home anonId={anonId} />;
}
