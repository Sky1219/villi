"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

// Reads the answer aloud with the browser's built-in speech, preferring a voice that runs on
// the device. No extra AI call: it speaks the reviewed text, minus citation tokens.
export function ReadAloud({ parts, lang }: { parts: string[]; lang: string }) {
  // False while prerendering, so the button only appears where the browser can speak.
  const supported = useSyncExternalStore(
    noop,
    () => "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);
  // Chrome can garbage-collect utterances nobody references, and then onend never fires.
  const queued = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    // Leaving the page, or the app going to the background, stops the voice.
    const hide = () => {
      if (document.visibilityState === "hidden") {
        synth.cancel();
        setSpeaking(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      synth.cancel();
    };
  }, []);

  useEffect(() => {
    if (!speaking) return;
    // Fallback for engines that drop onend: once nothing is speaking or queued, reset the button.
    const id = setInterval(() => {
      const synth = window.speechSynthesis;
      if (!synth.speaking && !synth.pending) setSpeaking(false);
    }, 1500);
    return () => clearInterval(id);
  }, [speaking]);

  if (!supported) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const start = () => {
    const synth = window.speechSynthesis;
    // Chrome sometimes drops a speak() that comes right after an unneeded cancel().
    if (synth.speaking || synth.pending) synth.cancel();
    queued.current = [];
    // Some browsers offer network voices (Chrome's "Google …"); use an on-device one when there is one.
    const base = lang.split("-")[0];
    const voice = synth.getVoices().find((v) => v.localService && v.lang.toLowerCase().startsWith(base)) ?? null;
    // One utterance per section, so the voice pauses between them.
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = 0.9;
      if (i === parts.length - 1) {
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
      }
      queued.current.push(u);
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
