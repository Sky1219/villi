"use client";

import { useSyncExternalStore } from "react";

const KEY = "villi.anonId";

// The anonymous device id is the only credential. It lives in localStorage
// and is never shown or sent anywhere but our own Convex functions.
function read(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

let cached: string | null = null;
const subscribe = () => () => {};

export function useAnonId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (cached ??= read()),
    () => null,
  );
}
