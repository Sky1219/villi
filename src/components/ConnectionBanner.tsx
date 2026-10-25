"use client";

import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";

// Lost connection, for longer than a blip: say so, instead of a page that looks frozen.
// A check that already started runs on the server and appears when the page reconnects.
export function connectionProblem(s: { isWebSocketConnected: boolean; hasEverConnected: boolean }): "lost" | "never" | null {
  if (s.isWebSocketConnected) return null;
  return s.hasEverConnected ? "lost" : "never";
}

const GRACE_MS = { lost: 4000, never: 10000 };

export function ConnectionBanner() {
  const problem = connectionProblem(useConvexConnectionState());
  const [shown, setShown] = useState<"lost" | "never" | null>(null);
  useEffect(() => {
    if (!problem) {
      const clear = setTimeout(() => setShown(null), 0);
      return () => clearTimeout(clear);
    }
    const t = setTimeout(() => setShown(problem), GRACE_MS[problem]);
    return () => clearTimeout(t);
  }, [problem]);
  if (!shown || !problem) return null;
  return (
    <div role="status" className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-sm print:hidden">
      <p className="font-bold">{shown === "lost" ? "No connection. Reconnecting…" : "Can't reach Villi yet. Still trying…"}</p>
      <p className="text-muted">
        {shown === "lost"
          ? "A check that already started keeps going, and this page updates when the connection is back."
          : "Check the phone's internet connection."}
      </p>
    </div>
  );
}
