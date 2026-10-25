"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

// Reads the answer aloud with the browser's own speech voice. No audio leaves the phone
// and there is no extra AI call: it speaks the reviewed text, minus citation tokens.
export function ReadAloud({ parts, lang }: { parts: string[]; lang: string }) {
  // False while prerendering, so the button only appears where the browser can speak.
  const supported = useSyncExternalStore(
    noop,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    // Leaving the page stops the voice.
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const start = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    // One utterance per section, so the voice pauses between them.
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 0.9;
      if (i === parts.length - 1) {
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
      }
      synth.speak(u);
    });
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={speaking ? stop : start}
      aria-pressed={speaking}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent px-3 text-sm font-bold text-accent"
    >
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {speaking ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
      </svg>
      {speaking ? "Stop reading" : "Read this answer aloud"}
    </button>
  );
}
