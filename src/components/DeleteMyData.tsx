"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { friendlyError } from "@/lib/errors";

export function DeleteMyData({ anonId }: { anonId: string }) {
  const del = useMutation(api.profiles.deleteMine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (!window.confirm("Delete this profile, its logs, questions and swaps from Villi? This can't be undone.")) return;
          setBusy(true);
          try {
            for (let i = 0; i < 50; i++) {
              const r = await del({ anonId });
              if (r.done) break;
            }
            localStorage.removeItem("villi.anonId");
            // Full reload so the in-memory device id is dropped too.
            window.location.reload();
          } catch (e) {
            setError(friendlyError(e));
            setBusy(false);
          }
        }}
        className="min-h-11 text-sm font-bold text-flag underline disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Delete my data"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </div>
  );
}
