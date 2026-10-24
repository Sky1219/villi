"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { friendlyError } from "@/lib/errors";

// "Use Villi on another phone": a 6-digit code, valid 10 minutes, used once.
export function DeviceLinks({ anonId }: { anonId: string }) {
  const d = useQuery(api.profiles.listDevices, { anonId });
  const create = useMutation(api.profiles.createDeviceCode);
  const revoke = useMutation(api.profiles.revokeDevice);
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!d) return null;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
      <h2 className="font-bold">Use Villi on another phone</h2>
      <p className="text-muted">
        For a family member who helps with the same medicines. The other phone gets the same profile, log and sheet.
      </p>
      {code ? (
        <p className="mt-2" role="status">
          On the other phone, open Villi and tap &ldquo;I have a code from another phone&rdquo;. Enter{" "}
          <span className="font-mono text-2xl font-bold tracking-widest">{code.code}</span> before{" "}
          {new Date(code.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. It works once.
        </p>
      ) : (
        <button
          onClick={async () => {
            setError(null);
            try {
              setCode(await create({ anonId }));
            } catch (e) {
              setError(friendlyError(e));
            }
          }}
          className="mt-2 min-h-11 w-full rounded-xl border border-accent px-3 font-bold text-accent"
        >
          Get a code
        </button>
      )}
      {d.devices.length > 0 && (
        <ul className="mt-3 space-y-2">
          {d.devices.map((dev) => (
            <li key={dev._id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3">
              <span>
                {dev.isThisPhone ? "This phone" : "A phone"} linked on {new Date(dev.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={async () => {
                  setError(null);
                  try {
                    await revoke({ anonId, linkId: dev._id });
                    if (dev.isThisPhone) window.location.reload();
                  } catch (e) {
                    setError(friendlyError(e));
                  }
                }}
                className="min-h-11 font-bold text-flag underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-flag">
          {error}
        </p>
      )}
    </section>
  );
}

// On a new phone with no profile: join an existing one with a code.
export function EnterDeviceCode({ anonId }: { anonId: string }) {
  const redeem = useMutation(api.profiles.redeemDeviceCode);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="min-h-11 text-sm font-bold text-accent underline">
        I have a code from another phone
      </button>
    );
  }
  return (
    <form
      className="space-y-2 rounded-2xl border border-border bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await redeem({ anonId, code });
          if (r.ok) window.location.reload();
          else setError(r.reason);
        } catch (err) {
          setError(friendlyError(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="device-code" className="block font-bold">
        The 6-digit code from the other phone
      </label>
      <input
        id="device-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        className="min-h-12 w-full rounded-xl border border-border bg-background px-3 font-mono text-xl tracking-widest"
      />
      <button disabled={busy || code.replace(/\D/g, "").length !== 6} className="min-h-12 w-full rounded-xl bg-accent font-bold text-accent-ink disabled:opacity-60">
        Join
      </button>
      {error && (
        <p role="alert" className="text-sm text-flag">
          {error}
        </p>
      )}
    </form>
  );
}
