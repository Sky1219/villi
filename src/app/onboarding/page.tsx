"use client";

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
import { GutDiagram } from "@/components/GutDiagram";
import { LANGUAGES, QuickProfileForm } from "@/components/QuickProfileForm";
import { MedsEditor } from "@/components/MedsEditor";

type Role = "patient" | "caregiver" | "clinician";
type Stoma = "none" | "jejunostomy" | "ileostomy" | "colostomy" | "unsure";

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

function Onboarding({ anonId }: { anonId: string }) {
  const router = useRouter();
  const profile = useQuery(api.profiles.me, { anonId });
  const upsert = useMutation(api.profiles.upsert);

  const [step, setStep] = useState<"role" | "anatomy" | "language" | "meds" | "describe">("role");
  const [role, setRole] = useState<Role>("patient");
  const [colon, setColon] = useState<"all" | "part" | "none" | null>(null);
  const [smallBowel, setSmallBowel] = useState<"most" | "some" | "none" | null>(null);
  const [stoma, setStoma] = useState<Stoma | null>(null);
  const [removed, setRemoved] = useState<SegmentId[]>([]);
  const [length, setLength] = useState<BowelLengthBand | "from-diagram">("from-diagram");
  const [language, setLanguage] = useState(() =>
    typeof navigator !== "undefined" && LANGUAGES.some((l) => navigator.language.startsWith(l.code))
      ? navigator.language.slice(0, 2)
      : "en",
  );
  const [saving, setSaving] = useState(false);

  const they = role === "caregiver";
  const stomaAfter = stomaAfterFor(stoma ?? "none", removed);
  const anatomy = deriveAnatomy({ removed, stomaAfter }, length);

  // Guided answers pre-mark segments; taps on the diagram still override.
  function applyGuides(next: { colon?: typeof colon; smallBowel?: typeof smallBowel }) {
    const c = next.colon ?? colon;
    const sb = next.smallBowel ?? smallBowel;
    const r = new Set<SegmentId>();
    if (c === "all") COLON.forEach((s) => r.add(s));
    if (c === "part") ["cecum", "ascending-colon"].forEach((s) => r.add(s as SegmentId));
    if (sb === "most") r.add("ileum");
    if (sb === "some") r.add("ileum");
    setRemoved(SEGMENTS.filter((s) => r.has(s)));
    if (sb === "most") setLength("<100cm");
    else if (sb === "some") setLength("100-200cm");
    else if (sb === "none") setLength(">200cm");
  }

  function toggle(id: SegmentId) {
    if (id === "stomach" || id === "duodenum") return; // never offered as removable in this build
    setRemoved((r) => (r.includes(id) ? r.filter((x) => x !== id) : SEGMENTS.filter((s) => r.includes(s) || s === id)));
  }

  async function save() {
    setSaving(true);
    try {
      await upsert({ anonId, role, language, anatomy, diagram: { removed, stomaAfter } });
      setStep("meds");
    } finally {
      setSaving(false);
    }
  }

  if (step === "describe") {
    return (
      <main className="space-y-4 pt-6">
        <button onClick={() => setStep("anatomy")} className="min-h-11 text-sm font-bold text-accent">
          ← Back to the diagram
        </button>
        <h1 className="text-2xl font-bold">Describe it instead</h1>
        <QuickProfileForm anonId={anonId} onDone={() => setStep("meds")} />
      </main>
    );
  }

  return (
    <main className="space-y-5 pt-6">
      <header>
        <p className="text-sm text-muted">Set up Villi</p>
        <h1 className="text-2xl font-bold">
          {step === "role" && "Who is this for?"}
          {step === "anatomy" && (they ? "Their gut, after surgery" : "Your gut, after surgery")}
          {step === "language" && "Which language?"}
          {step === "meds" && (they ? "Their medicines" : "Your medicines")}
        </h1>
      </header>

      {step === "role" && (
        <section className="space-y-3">
          {(
            [
              ["patient", "Me, I'm the patient"],
              ["caregiver", "Someone I care for"],
              ["clinician", "I'm a clinician"],
            ] as const
          ).map(([r, label]) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setStep("anatomy");
              }}
              className={`${chip(false)} w-full text-lg`}
            >
              {label}
            </button>
          ))}
          <p className="text-sm text-muted">
            Villi never asks for a name, birthday, or medical history. Your setup is tied to a random id on this device
            only.
          </p>
        </section>
      )}

      {step === "anatomy" && (
        <>
          <section className="space-y-3">
            <Question label={`Did they remove ${they ? "their" : "your"} colon (large intestine)?`}>
              {(
                [
                  ["all", "All of it"],
                  ["part", "Part of it"],
                  ["none", "No"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  className={chip(colon === v)}
                  aria-pressed={colon === v}
                  onClick={() => {
                    setColon(v);
                    applyGuides({ colon: v });
                  }}
                >
                  {l}
                </button>
              ))}
            </Question>
            <Question label="How much small bowel was removed?">
              {(
                [
                  ["most", "Most of it"],
                  ["some", "Some"],
                  ["none", "None or a little"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  className={chip(smallBowel === v)}
                  aria-pressed={smallBowel === v}
                  onClick={() => {
                    setSmallBowel(v);
                    applyGuides({ smallBowel: v });
                  }}
                >
                  {l}
                </button>
              ))}
            </Question>
            <Question label={`Is there a stoma (a bag)?`}>
              {(
                [
                  ["none", "No stoma"],
                  ["jejunostomy", "From the upper small bowel (jejunostomy)"],
                  ["ileostomy", "From the lower small bowel (ileostomy)"],
                  ["colostomy", "From the colon (colostomy)"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} className={chip(stoma === v)} aria-pressed={stoma === v} onClick={() => setStoma(v)}>
                  {l}
                </button>
              ))}
            </Question>
          </section>

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
              className="w-full rounded-xl border border-border bg-surface px-3 py-3"
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
            onClick={() => setStep("language")}
            className="min-h-12 w-full rounded-xl bg-accent px-4 text-lg font-bold text-accent-ink"
          >
            Looks right
          </button>
          <button onClick={() => setStep("describe")} className="min-h-11 w-full text-sm font-bold text-accent underline">
            I&apos;d rather describe it
          </button>
        </>
      )}

      {step === "language" && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => setLanguage(l.code)} aria-pressed={language === l.code} className={chip(language === l.code)}>
                {l.label}
              </button>
            ))}
          </div>
          <button
            disabled={saving}
            onClick={save}
            className="min-h-12 w-full rounded-xl bg-accent px-4 text-lg font-bold text-accent-ink disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </section>
      )}

      {step === "meds" && (
        <section className="space-y-4">
          <p className="text-muted">
            Optional. Add {they ? "their" : "your"} medicines so Villi can check each one against this anatomy.
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

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold">{label}</legend>
      <div className="grid gap-2">{children}</div>
    </fieldset>
  );
}

export default function OnboardingPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Onboarding anonId={anonId} />;
}
