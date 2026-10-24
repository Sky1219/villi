"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Anatomy, BowelLengthBand } from "@convex/lib/anatomy";

const ANATOMY_CHOICES: { label: string; value: Pick<Anatomy, "stomaType" | "colonInContinuity"> }[] = [
  { label: "End-jejunostomy (no colon)", value: { stomaType: "jejunostomy", colonInContinuity: false } },
  { label: "Small bowel joined to colon (no stoma)", value: { stomaType: "none", colonInContinuity: true } },
  { label: "Ileostomy", value: { stomaType: "ileostomy", colonInContinuity: false } },
  { label: "Colostomy", value: { stomaType: "colostomy", colonInContinuity: false } },
];

const LENGTHS: { label: string; value: BowelLengthBand }[] = [
  { label: "I don't know", value: "unknown" },
  { label: "Less than 100 cm", value: "<100cm" },
  { label: "100 to 200 cm", value: "100-200cm" },
  { label: "More than 200 cm", value: ">200cm" },
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文 (简体)" },
  { code: "ar", label: "العربية" },
  { code: "te", label: "తెలుగు" },
];

const field = "w-full rounded-xl border border-border bg-surface px-3 py-3 text-base";

export function QuickProfileForm({ anonId, onDone }: { anonId: string; onDone?: () => void }) {
  const upsert = useMutation(api.profiles.upsert);
  const [role, setRole] = useState<"patient" | "caregiver" | "clinician">("patient");
  const [anatomy, setAnatomy] = useState(0);
  const [length, setLength] = useState<BowelLengthBand>("unknown");
  const [language, setLanguage] = useState("en");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await upsert({
            anonId,
            role,
            language,
            anatomy: { ...ANATOMY_CHOICES[anatomy].value, bowelLengthBand: length },
          });
          onDone?.();
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-2 font-bold">I am</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["patient", "caregiver", "clinician"] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`min-h-11 rounded-xl border px-2 py-2 ${
                role === r ? "border-accent bg-accent-soft font-bold" : "border-border bg-surface"
              }`}
            >
              {r === "patient" ? "the patient" : r === "caregiver" ? "a caregiver" : "a clinician"}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block font-bold">{role === "caregiver" ? "Their" : "My"} anatomy</span>
        <select className={field} value={anatomy} onChange={(e) => setAnatomy(Number(e.target.value))}>
          {ANATOMY_CHOICES.map((c, i) => (
            <option key={c.label} value={i}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block font-bold">Small bowel left</span>
        <select className={field} value={length} onChange={(e) => setLength(e.target.value as BowelLengthBand)}>
          {LENGTHS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block font-bold">Language</span>
        <select className={field} value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted">
        No name, no birthday, no medical history. Villi only keeps this coarse anatomy, tied to a random id on this
        device.
      </p>
      <button
        disabled={saving}
        className="min-h-12 w-full rounded-xl bg-accent px-4 py-3 text-lg font-bold text-accent-ink disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
