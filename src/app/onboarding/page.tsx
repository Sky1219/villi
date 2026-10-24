"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  COLON,
  SEGMENT_LABELS,
  SEGMENTS,
  deriveAnatomy,
  describeAnatomy,
  type BowelLengthBand,
  type SegmentId,
} from "@convex/lib/anatomy";
import { useAnonId } from "@/lib/anon";
import { friendlyError } from "@/lib/errors";
import { GutDiagram } from "@/components/GutDiagram";
import { QuickProfileForm } from "@/components/QuickProfileForm";
import { CARES_FOR_CHOICES, type CaresFor } from "@convex/lib/careFor";
import { MedsEditor } from "@/components/MedsEditor";

type Role = "patient" | "caregiver" | "clinician";
type Stoma = "none" | "jejunostomy" | "ileostomy" | "colostomy" | "unsure";
type Colon = "all" | "part" | "none" | "unsure";
type SmallBowel = "most" | "some" | "none" | "unsure";
type Step = "role" | "relation" | "colon" | "smallBowel" | "stoma" | "check" | "meds" | "describe";
type Profile = NonNullable<ReturnType<typeof useQuery<typeof api.profiles.me>>>;

// One question per screen; "check" shows the diagram the answers produced so it can be adjusted.
// Answers are English-only in this build, so there is no language step.
const flowFor = (role: Role): Step[] =>
  role === "caregiver" ? ["role", "relation", "colon", "smallBowel", "stoma", "check"] : ["role", "colon", "smallBowel", "stoma", "check"];

const chip = (on: boolean) =>
  `min-h-12 rounded-xl border px-3 py-2 text-left ${on ? "border-accent bg-accent-soft font-bold" : "border-border bg-surface"}`;

function stomaAfterFor(stoma: Stoma, removed: SegmentId[]): SegmentId | null {
  if (stoma === "jejunostomy") return "jejunum";
  if (stoma === "ileostomy") return "ileum";
  if (stoma === "colostomy") {
    const kept = COLON.filter((s) => !removed.includes(s));
    return kept.length ? kept[kept.length - 1] : "transverse-colon";
  }
  return null;
}

// Read the saved setup back into answers, so "Change" starts from what is already there.
function seedFrom(p: Profile | null) {
  if (!p) return null;
  const removed = p.diagram.removed as SegmentId[];
  const colonGone = COLON.filter((s) => removed.includes(s)).length;
  const band = p.anatomy.bowelLengthBand;
  return {
    role: p.role as Role,
    caresFor: p.caresFor,
    language: p.language,
    removed,
    stoma: p.anatomy.stomaType as Stoma,
    colon: (colonGone === 0 ? "none" : colonGone === COLON.length ? "all" : "part") as Colon,
    smallBowel: (band === "<100cm" ? "most" : band === "100-200cm" ? "some" : band === ">200cm" ? "none" : "unsure") as SmallBowel,
    length: band as BowelLengthBand,
  };
}

function Onboarding({ anonId, profile }: { anonId: string; profile: Profile | null }) {
  const router = useRouter();
  const upsert = useMutation(api.profiles.upsert);
  const seed = seedFrom(profile);

  const [step, setStep] = useState<Step>(seed ? "check" : "role");
  const [role, setRole] = useState<Role>(seed?.role ?? "patient");
  const [colon, setColon] = useState<Colon | null>(seed?.colon ?? null);
  const [smallBowel, setSmallBowel] = useState<SmallBowel | null>(seed?.smallBowel ?? null);
  const [stoma, setStoma] = useState<Stoma | null>(seed?.stoma ?? null);
  const [removed, setRemoved] = useState<SegmentId[]>(seed?.removed ?? []);
  const [length, setLength] = useState<BowelLengthBand | "from-diagram">(seed?.length ?? "from-diagram");
  const [caresFor, setCaresFor] = useState<CaresFor | null>(seed?.caresFor ?? null);
  const language = seed?.language ?? "en";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const they = role === "caregiver";
  const their = they ? "their" : "your";
  const stomaAfter = stomaAfterFor(stoma ?? "none", removed);
  const anatomy = deriveAnatomy({ removed, stomaAfter }, length);
  const flow = flowFor(role);
  const index = flow.indexOf(step);
  const next = () => setStep(flow[index + 1]);
  const back = () => setStep(step === "describe" ? "check" : flow[index - 1]);

  // Guided answers pre-mark segments; the check step's taps adjust them afterwards.
  function applyGuides(n: { colon?: Colon; smallBowel?: SmallBowel }) {
    const c = n.colon ?? colon;
    const sb = n.smallBowel ?? smallBowel;
    const r = new Set<SegmentId>();
    if (c === "all") COLON.forEach((s) => r.add(s));
    if (c === "part") ["cecum", "ascending-colon"].forEach((s) => r.add(s as SegmentId));
    if (sb === "most" || sb === "some") r.add("ileum");
    setRemoved(SEGMENTS.filter((s) => r.has(s)));
    setLength(sb === "most" ? "<100cm" : sb === "some" ? "100-200cm" : sb === "none" ? ">200cm" : "from-diagram");
  }

  function toggle(id: SegmentId) {
    if (id === "stomach" || id === "duodenum") return; // never offered as removable in this build
    setRemoved((r) => (r.includes(id) ? r.filter((x) => x !== id) : SEGMENTS.filter((s) => r.includes(s) || s === id)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await upsert({ anonId, role, language, caresFor: caresFor ?? undefined, anatomy, diagram: { removed, stomaAfter } });
      setStep("meds");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const title: Record<Step, string> = {
    role: "Who is this for?",
    relation: "Who do you care for?",
    colon: `Was ${their} colon (large intestine) removed?`,
    smallBowel: `How much of ${their} small bowel was removed?`,
    stoma: `Is there a stoma (a bag)?`,
    check: "Does this look right?",
    meds: they ? "Their medicines" : "Your medicines",
    describe: "Describe it instead",
  };

  const options = <T extends string>(items: readonly (readonly [T, string])[], value: T | null, pick: (v: T) => void) => (
    <div role="group" aria-labelledby="step-title" className="grid gap-2">
      {items.map(([v, l]) => (
        <button key={v} className={chip(value === v)} aria-pressed={value === v} onClick={() => pick(v)}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <main className="space-y-5 pt-4">
      <nav className="flex min-h-11 items-center justify-between">
        {index > 0 || step === "describe" ? (
          <button onClick={back} className="min-h-11 text-sm font-bold text-accent">
            ← Back
          </button>
        ) : step === "meds" ? (
          <span />
        ) : (
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-accent">
            {profile ? "Keep current setup" : "Cancel"}
          </Link>
        )}
        {index >= 0 && (
          <span className="text-sm text-muted">
            Step {index + 1} of {flow.length}
          </span>
        )}
      </nav>

      <header>
        <p className="text-sm text-muted">Set up Villi</p>
        <h1 id="step-title" className="text-2xl font-bold">
          {title[step]}
        </h1>
      </header>

      {step === "role" && (
        <section className="space-y-3">
          {options(
            [
              ["patient", "Me, I'm the patient"],
              ["caregiver", "Someone I care for"],
              ["clinician", "I'm a clinician"],
            ] as const,
            profile ? role : null,
            (v) => {
              setRole(v);
              setStep(v === "caregiver" ? "relation" : "colon");
            },
          )}
          <p className="text-sm text-muted">
            Villi never asks for a name, birthday, or medical history. Your setup is tied to a random id on this device
            only.
          </p>
        </section>
      )}

      {step === "relation" && (
        <section className="space-y-3">
          {options(CARES_FOR_CHOICES, caresFor, (v) => {
            setCaresFor(v);
            next();
          })}
          <p className="text-sm text-muted">
            You&apos;ll set up their anatomy and medicines, and check and log things on their behalf. No names.
          </p>
        </section>
      )}

      {step === "colon" &&
        options(
          [
            ["all", "All of it"],
            ["part", "Part of it"],
            ["none", "No"],
            ["unsure", "Not sure"],
          ] as const,
          colon,
          (v) => {
            setColon(v);
            applyGuides({ colon: v });
            next();
          },
        )}

      {step === "smallBowel" &&
        options(
          [
            ["most", "Most of it"],
            ["some", "Some"],
            ["none", "None or a little"],
            ["unsure", "Not sure"],
          ] as const,
          smallBowel,
          (v) => {
            setSmallBowel(v);
            applyGuides({ smallBowel: v });
            next();
          },
        )}

      {step === "stoma" &&
        options(
          [
            ["none", "No stoma"],
            ["jejunostomy", "From the upper small bowel (jejunostomy)"],
            ["ileostomy", "From the lower small bowel (ileostomy)"],
            ["colostomy", "From the colon (colostomy)"],
            ["unsure", "Not sure"],
          ] as const,
          stoma,
          (v) => {
            setStoma(v);
            next();
          },
        )}

      {(step === "colon" || step === "smallBowel" || step === "stoma") && (
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm">
          <GutDiagram size="badge" removed={removed} stoma={stomaAfter ? { afterSegment: stomaAfter } : null} />
          <span>
            So far: <span className="font-bold">{describeAnatomy(anatomy)}</span>
          </span>
        </div>
      )}

      {step === "check" && (
        <>
          <section className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm text-muted">Tap any part to mark it removed, or tap again to put it back.</p>
            <GutDiagram removed={removed} stoma={stomaAfter ? { afterSegment: stomaAfter } : null} interactive onToggle={toggle} />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Parts of the intestine">
              {SEGMENTS.filter((s) => s !== "stomach" && s !== "duodenum").map((s) => (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  aria-pressed={removed.includes(s)}
                  className={`min-h-11 rounded-full border px-3 text-sm ${
                    removed.includes(s) ? "border-border bg-surface-2 text-muted line-through" : "border-border bg-background"
                  }`}
                >
                  {SEGMENT_LABELS[s]}
                </button>
              ))}
            </div>
          </section>

          <label className="block">
            <span className="mb-2 block font-bold">Small bowel left</span>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value as BowelLengthBand | "from-diagram")}
              className="min-h-12 w-full rounded-xl border border-border bg-surface px-3"
            >
              <option value="from-diagram">I don&apos;t know, roughly what I tapped</option>
              <option value="<100cm">Less than 100 cm</option>
              <option value="100-200cm">100 to 200 cm</option>
              <option value=">200cm">More than 200 cm</option>
              <option value="unknown">I really don&apos;t know</option>
            </select>
          </label>

          <p className="rounded-xl bg-surface-2 p-3 text-sm">
            Villi will use: <span className="font-bold">{describeAnatomy(anatomy)}</span>
          </p>
          <button
            disabled={saving}
            onClick={save}
            className="min-h-12 w-full rounded-xl bg-accent px-4 text-lg font-bold text-accent-ink disabled:opacity-60"
          >
            {saving ? "Saving…" : "Looks right, save"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-flag">
              {error}
            </p>
          )}
          <button onClick={() => setStep("describe")} className="min-h-11 w-full text-sm font-bold text-accent underline">
            I&apos;d rather describe it
          </button>
        </>
      )}

      {step === "describe" && <QuickProfileForm anonId={anonId} onDone={() => setStep("meds")} />}

      {step === "meds" && (
        <section className="space-y-4">
          <p className="text-muted">
            Optional. Add {their} medicines so Villi can check each one against this anatomy.
          </p>
          {profile && <MedsEditor anonId={anonId} meds={profile.meds} />}
          <button onClick={() => router.push("/")} className="min-h-12 w-full rounded-xl bg-accent px-4 text-lg font-bold text-accent-ink">
            Done
          </button>
        </section>
      )}
    </main>
  );
}

function OnboardingLoader({ anonId }: { anonId: string }) {
  const profile = useQuery(api.profiles.me, { anonId });
  if (profile === undefined) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Onboarding anonId={anonId} profile={profile} />;
}

export default function OnboardingPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <OnboardingLoader anonId={anonId} />;
}
