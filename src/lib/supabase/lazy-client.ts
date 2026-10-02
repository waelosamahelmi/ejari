"use client";
import type { supabaseBrowser as SupabaseBrowser } from "./client";

type Client = ReturnType<typeof SupabaseBrowser>;
let pending: Promise<Client> | null = null;

/** The browser Supabase client (~70KB gz), loaded on demand instead of with the app shell. */
export function lazySupabase(): Promise<Client> {
  pending ??= import("./client").then((m) => m.supabaseBrowser());
  return pending;
}

/** Runs `fn` when the main thread is idle (or after `timeout` ms), so it never delays first paint. */
export function whenIdle(fn: () => void, timeout = 2000): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 600);
  return () => window.clearTimeout(id);
}
