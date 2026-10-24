"use client";

import { friendlyError } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { downscaleToJpeg } from "@/lib/image";

type Med = { _id: Id<"meds">; name: string; dosageForm: string | null };

export function MedsEditor({ anonId, meds, checkable = false }: { anonId: string; meds: Med[]; checkable?: boolean }) {
  const router = useRouter();
  const add = useMutation(api.meds.add);
  const addFromPhoto = useMutation(api.meds.addFromPhoto);
  const remove = useMutation(api.meds.remove);
  const uploadUrl = useMutation(api.answers.generateUploadUrl);
  const start = useMutation(api.answers.start);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedName, setRemovedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A single tap removes; undo re-adds by name (the label lookup runs again).
  async function removeMed(m: Med) {
    setError(null);
    try {
      await remove({ anonId, medId: m._id });
      setRemovedName(m.name);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function undoRemove() {
    if (!removedName) return;
    try {
      await add({ anonId, name: removedName });
      setRemovedName(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function check(m: Med) {
    setError(null);
    try {
      const id = await start({ anonId, text: m.name, category: "pill" });
      router.push(`/answer/${id}`);
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function onPhoto(file: File) {
    setError(null);
    setReading(true);
    try {
      const blob = await downscaleToJpeg(file);
      const url = await uploadUrl({ anonId });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) throw new Error("Upload failed. Try typing the name.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await addFromPhoto({ anonId, photoId: storageId });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      // The new med appears through the live query once the photo is read.
      setTimeout(() => setReading(false), 4000);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {meds.map((m) => (
          <li key={m._id} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-bold break-words">{m.name}</span>
              <span className="block text-xs text-muted">{m.dosageForm ? m.dosageForm.toLowerCase() : "looking up the FDA label…"}</span>
            </span>
            {checkable && (
              <button onClick={() => check(m)} className="min-h-11 rounded-lg px-2 text-sm font-bold text-accent">
                Check
              </button>
            )}
            <button
              onClick={() => removeMed(m)}
              aria-label={`Remove ${m.name}`}
              className="min-h-11 min-w-11 rounded-lg text-muted"
            >
              ✕
            </button>
          </li>
        ))}
        {meds.length === 0 && <li className="text-sm text-muted">No medicines yet.</li>}
      </ul>
      {removedName && (
        <p role="status" className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 text-sm">
          <span>Removed {removedName}.</span>
          <button onClick={undoRemove} className="min-h-11 font-bold text-accent underline">
            Undo
          </button>
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError(null);
          try {
            await add({ anonId, name });
            setName("");
          } catch (err) {
            setError(friendlyError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="med-name" className="sr-only">
          Medicine name
        </label>
        <input
          id="med-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name as printed on the label"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-3"
          autoComplete="off"
        />
        <button disabled={busy || !name.trim()} className="min-h-12 rounded-xl border border-accent px-4 font-bold text-accent disabled:opacity-50">
          Add
        </button>
      </form>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={reading}
        className="min-h-12 w-full rounded-xl border border-border bg-surface px-4 font-bold disabled:opacity-60"
      >
        {reading ? "Reading the label…" : "Add from a photo of the bottle"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPhoto(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </div>
  );
}
