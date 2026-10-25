"use client";

import { useSyncExternalStore } from "react";
import { TEXT_SIZES, TEXT_SIZE_KEY, parseTextSize, type TextSize } from "@/lib/textSize";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const read = (): TextSize => parseTextSize(document.documentElement.dataset.text);

function apply(s: TextSize) {
  const root = document.documentElement;
  if (s === "standard") root.removeAttribute("data-text");
  else root.setAttribute("data-text", s);
  try {
    localStorage.setItem(TEXT_SIZE_KEY, s);
  } catch {
    // Private mode: the size still applies until the page closes.
  }
  listeners.forEach((fn) => fn());
}

const LABEL: Record<TextSize, string> = { standard: "Standard text", large: "Large text", largest: "Largest text" };
const GLYPH: Record<TextSize, string> = { standard: "text-sm", large: "text-base", largest: "text-xl" };

// Text size for tired or low-vision readers. Every size in the app is in rem, so the
// whole page scales from the root. Remembered on this device only.
export function TextSizePicker() {
  const size = useSyncExternalStore(subscribe, read, () => "standard" as TextSize);
  return (
    <div role="group" aria-label="Text size" className="flex shrink-0 overflow-hidden rounded-xl border border-border bg-surface">
      {TEXT_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => apply(s)}
          aria-pressed={size === s}
          aria-label={LABEL[s]}
          className={`flex min-h-11 min-w-11 items-center justify-center font-bold ${GLYPH[s]} ${size === s ? "bg-accent-soft text-accent" : ""}`}
        >
          A
        </button>
      ))}
    </div>
  );
}
