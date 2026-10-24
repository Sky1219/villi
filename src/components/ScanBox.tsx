"use client";

import { friendlyError } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { downscaleToJpeg } from "@/lib/image";

export function ScanBox({ anonId, initialText = "" }: { anonId: string; initialText?: string }) {
  const router = useRouter();
  const start = useMutation(api.answers.start);
  const uploadUrl = useMutation(api.answers.generateUploadUrl);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState<null | "photo" | "text">(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function go(args: { text?: string; photoId?: Id<"_storage"> }) {
    const answerId = await start({ anonId, ...args });
    router.push(`/answer/${answerId}`);
  }

  async function onPhoto(file: File) {
    setError(null);
    setBusy("photo");
    try {
      const blob = await downscaleToJpeg(file);
      const url = await uploadUrl({ anonId });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) throw new Error("Upload failed. Try again, or type the name.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await go({ photoId: storageId });
    } catch (e) {
      setError(friendlyError(e));
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-bold">Check a medicine or drink</h2>
      <p className="mb-3 text-sm text-muted">Photograph a medicine or drink label, or type the name as it&apos;s printed. Villi checks pills and drinks; the community teaches food, so log how a food went below.</p>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={!!busy}
        className="mb-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-accent-ink disabled:opacity-60"
      >
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {busy === "photo" ? "Reading photo…" : "Take a photo"}
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
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setError(null);
          setBusy("text");
          try {
            await go({ text: text.trim() });
          } catch (err) {
            setError(friendlyError(err));
            setBusy(null);
          }
        }}
      >
        <label className="sr-only" htmlFor="scan-text">
          Item name
        </label>
        <input
          id="scan-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Metoprolol ER 50 mg"
          className="min-h-12 flex-1 rounded-xl border border-border bg-background px-3 text-base"
          autoComplete="off"
        />
        <button
          disabled={!!busy || !text.trim()}
          className="min-h-12 rounded-xl border border-accent px-4 font-bold text-accent disabled:opacity-50"
        >
          {busy === "text" ? "…" : "Check"}
        </button>
      </form>
      <p className="mt-3 text-xs text-muted">
        Photos are deleted as soon as the name is read. Bottle labels can show your name; Villi never stores them.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
    </section>
  );
}
