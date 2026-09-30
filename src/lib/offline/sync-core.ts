import { offlineDb } from "./db";

let running: Promise<{ synced: number; review: number }> | null = null;

/**
 * Sends pending outbox payments to /api/offline/sync. Shared by the page and the
 * service worker (Background Sync), so it touches no window APIs. The server is
 * idempotent on client_id; conflicts (contract ended, period closed, duplicate
 * receipt) move the item to "review".
 */
export function syncPending(): Promise<{ synced: number; review: number }> {
  running ??= run().finally(() => (running = null));
  return running;
}

async function run() {
  let synced = 0;
  let review = 0;
  const db = await offlineDb();
  const pending = (await db.getAll("outbox")).filter((i) => i.status === "pending");
  if (!pending.length) return { synced, review };
  for (const p of pending) await db.put("outbox", { ...p, status: "syncing" });
  try {
    const res = await fetch("/api/offline/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: pending.map((p) => p.input) }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const out = (await res.json()) as {
      results: { clientId: string; ok: boolean; error?: string }[];
    };
    for (const item of pending) {
      const r = out.results.find((x) => x.clientId === item.clientId);
      if (r?.ok) {
        await db.delete("outbox", item.clientId);
        synced++;
      } else if (!r || r.error === "network" || r.error === "generic") {
        await db.put("outbox", { ...item, status: "pending", attempts: item.attempts + 1 });
      } else {
        await db.put("outbox", {
          ...item,
          status: "review",
          error: r.error,
          attempts: item.attempts + 1,
        });
        review++;
      }
    }
  } catch {
    for (const item of pending)
      await db.put("outbox", { ...item, status: "pending", attempts: item.attempts + 1 });
  }
  return { synced, review };
}
