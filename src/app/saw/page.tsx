"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAnonId } from "@/lib/anon";
import { downscaleToJpeg } from "@/lib/image";

const SHAPES = [
  { v: "round", label: "Round", cls: "h-6 w-6 rounded-full" },
  { v: "oval", label: "Oval", cls: "h-5 w-8 rounded-[50%]" },
  { v: "oblong", label: "Oblong", cls: "h-4 w-9 rounded-md" },
  { v: "capsule", label: "Capsule", cls: "h-4 w-9 rounded-full" },
] as const;

const COLORS = [
  { v: "white", hex: "#f5f2ec" },
  { v: "yellow", hex: "#f3d35b" },
  { v: "pink", hex: "#f2a7bd" },
  { v: "orange", hex: "#f0a060" },
  { v: "blue", hex: "#7fa7d9" },
  { v: "green", hex: "#8cc08a" },
  { v: "brown", hex: "#a07a5a" },
  { v: "red", hex: "#d9655b" },
  { v: "two-tone", hex: "linear-gradient(90deg,#d9655b 50%,#f5f2ec 50%)" },
] as const;

const SIZES = ["small", "medium", "large"] as const;

const chip = (on: boolean) =>
  `flex min-h-12 items-center gap-2 rounded-xl border px-3 ${on ? "border-accent bg-accent-soft font-bold" : "border-border bg-surface"}`;

function Saw({ anonId }: { anonId: string }) {
  const router = useRouter();
  const start = useMutation(api.answers.start);
  const uploadUrl = useMutation(api.answers.generateUploadUrl);
  const [shape, setShape] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [imprint, setImprint] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (cur: string | null, v: string) => (cur === v ? null : v);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let photoId: Id<"_storage"> | undefined;
      if (photo) {
        const url = await uploadUrl({ anonId });
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: photo });
        if (!res.ok) throw new Error("Photo upload failed. You can continue without it.");
        photoId = ((await res.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      const id = await start({ anonId, photoId, saw: { shape, color, size, imprint: imprint.trim() || null } });
      router.push(`/answer/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <header>
        <h1 className="text-2xl font-bold">I saw something</h1>
        <p className="text-muted">
          Saw what looked like a whole tablet or capsule come through? It happens, and it&apos;s worth asking about.
          Describe it and Villi will check it against your own medicines.
        </p>
      </header>

      <fieldset>
        <legend className="mb-2 font-bold">Shape</legend>
        <div className="grid grid-cols-2 gap-2">
          {SHAPES.map((s) => (
            <button key={s.v} onClick={() => setShape(toggle(shape, s.v))} aria-pressed={shape === s.v} className={chip(shape === s.v)}>
              <span aria-hidden className={`inline-block shrink-0 border border-border bg-surface-2 ${s.cls}`} />
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-bold">Color</legend>
        <div className="grid grid-cols-3 gap-2">
          {COLORS.map((c) => (
            <button key={c.v} onClick={() => setColor(toggle(color, c.v))} aria-pressed={color === c.v} className={chip(color === c.v)}>
              <span aria-hidden className="inline-block h-5 w-5 shrink-0 rounded-full border border-border" style={{ background: c.hex }} />
              <span className="capitalize">{c.v}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-bold">Size</legend>
        <div className="grid grid-cols-3 gap-2">
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(toggle(size, s))} aria-pressed={size === s} className={`${chip(size === s)} justify-center capitalize`}>
              {s}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-2 block font-bold">Letters or numbers on it (optional)</span>
        <input
          value={imprint}
          onChange={(e) => setImprint(e.target.value)}
          maxLength={20}
          placeholder="e.g. M 50"
          className="min-h-12 w-full rounded-xl border border-border bg-surface px-3"
        />
      </label>

      <div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="min-h-12 w-full rounded-xl border border-border bg-surface px-4 font-bold"
        >
          {photo ? "Photo added ✓ (tap to replace)" : "Add a photo of the tablet (optional)"}
        </button>
        <p className="mt-1 text-xs text-muted">
          Rinse it and place it on a paper towel or plain surface. Photos are deleted after reading.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setPhoto(await downscaleToJpeg(f));
          }}
        />
      </div>

      <button
        disabled={busy || (!shape && !color && !imprint.trim() && !photo)}
        onClick={submit}
        className="min-h-14 w-full rounded-xl bg-accent px-4 text-lg font-bold text-accent-ink disabled:opacity-50"
      >
        {busy ? "Checking…" : "Check against my medicines"}
      </button>
      {error && <p className="text-sm text-flag">{error}</p>}
    </main>
  );
}

export default function SawPage() {
  const anonId = useAnonId();
  if (!anonId) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Saw anonId={anonId} />;
}
