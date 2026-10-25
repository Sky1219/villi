"use client";

import { friendlyError } from "@/lib/errors";
import { useAction, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { looksLikeNdc } from "@convex/lib/barcode";
import { BarcodeScanner } from "./BarcodeScanner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { downscaleToJpeg } from "@/lib/image";

export function ScanBox({ anonId, initialText = "" }: { anonId: string; initialText?: string }) {
  const router = useRouter();
  const start = useMutation(api.answers.start);
  const uploadUrl = useMutation(api.answers.generateUploadUrl);
  const [text, setText] = useState(initialText);
  const resolveBarcode = useAction(api.fda.resolveBarcode);
  const [busy, setBusy] = useState<null | "photo" | "text" | "barcode">(null);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A scanned barcode or typed NDC: resolve it to one product, then run the normal check on it.
  const fromCode = useCallback(
    async (code: string) => {
      setScanning(false);
      setError(null);
      setBusy("barcode");
      try {
        const r = await resolveBarcode({ anonId, code });
        if (!r.found) {
          setError(r.reason);
          setBusy(null);
          return;
        }
        setFound(r.name);
        const answerId = await start({ anonId, text: r.name, productNdc: r.productNdc, barcodePath: r.path });
        router.push(`/answer/${answerId}`);
      } catch (e) {
        setError(friendlyError(e));
        setBusy(null);
      }
    },
    [anonId, resolveBarcode, router, start],
  );

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
      <p className="mb-3 text-sm text-muted">
        Scan the barcode on a pharmacy bottle, photograph a box or drink label, or type the name or NDC as it&apos;s printed.
        Villi checks pills and drinks; the community teaches food, so log how a food went below.
      </p>
      {scanning ? (
        <BarcodeScanner onCode={fromCode} onClose={() => setScanning(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setScanning(true)}
          disabled={!!busy}
          className="mb-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-lg font-bold text-accent-ink disabled:opacity-60"
        >
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6v12M7 6v12M11 6v12M14 6v12M18 6v12M20 6v12" />
          </svg>
          {busy === "barcode" ? (found ? `Found ${found}…` : "Looking it up…") : "Scan the barcode"}
        </button>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={!!busy}
        className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-accent px-4 py-2 font-bold text-accent disabled:opacity-60"
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
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (looksLikeNdc(text)) return void fromCode(text.trim());
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
          className="min-h-12 min-w-0 flex-[1_1_12rem] rounded-xl border border-border bg-background px-3 text-base"
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
