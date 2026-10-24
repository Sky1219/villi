"use client";

import { friendlyError } from "@/lib/errors";
import { useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";

function DemoClone() {
  const anonId = useAnonId();
  const params = useSearchParams();
  const router = useRouter();
  const clone = useMutation(api.profiles.cloneDemo);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const as = params.get("as") === "peer" ? "peer" : "father";

  useEffect(() => {
    if (!anonId || started.current) return;
    started.current = true;
    clone({ anonId, as })
      .then(() => router.replace("/"))
      .catch((e: unknown) => setError(friendlyError(e)));
  }, [anonId, as, clone, router]);

  return (
    <main className="flex flex-1 items-center justify-center text-center">
      {error ? <p role="alert" className="text-flag">{error}</p> : <p className="text-muted">Loading the demo profile…</p>}
    </main>
  );
}

export default function DemoPage() {
  return (
    <Suspense>
      <DemoClone />
    </Suspense>
  );
}
