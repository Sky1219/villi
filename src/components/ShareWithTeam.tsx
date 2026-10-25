"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { friendlyError } from "@/lib/errors";

const linkFor = (token: string) => (typeof window === "undefined" ? `/team/${token}` : `${window.location.origin}/team/${token}`);

// "Share with the care team": a read-only link to this sheet. The person who
// has it can record what happened to each question. Expires in 14 days; revocable.
export function ShareWithTeam({ anonId }: { anonId: string }) {
  const links = useQuery(api.careTeam.myLinks, { anonId });
  const create = useMutation(api.careTeam.createLink);
  const revoke = useMutation(api.careTeam.revokeLink);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function share(token: string) {
    const url = linkFor(token);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Appointment sheet", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(token);
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  }

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-bold">Share with the care team</h2>
      <p className="text-sm text-muted">
        A private link to this sheet for the pharmacist or doctor. They can mark what happened to each question, and it
        comes back here. Anyone with the link can open it, so share it only with the care team. It expires in 14 days.
      </p>
      <button
        onClick={async () => {
          setError(null);
          try {
            const { token } = await create({ anonId });
            await share(token);
          } catch (e) {
            setError(friendlyError(e));
          }
        }}
        className="min-h-12 w-full rounded-xl border border-accent px-4 font-bold text-accent"
      >
        Create a link
      </button>
      {links && links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.token} className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="break-all text-xs">{linkFor(l.token)}</p>
              <p className="text-xs text-muted">Expires {new Date(l.expiresAt).toLocaleDateString()}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => share(l.token)} className="min-h-11 rounded-xl border border-accent px-3 font-bold text-accent">
                  {copied === l.token ? "Copied ✓" : "Share or copy"}
                </button>
                <button
                  onClick={async () => {
                    setError(null);
                    try {
                      await revoke({ anonId, token: l.token });
                    } catch (e) {
                      setError(friendlyError(e));
                    }
                  }}
                  className="min-h-11 rounded-xl border border-border bg-background px-3 font-bold"
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </section>
  );
}
