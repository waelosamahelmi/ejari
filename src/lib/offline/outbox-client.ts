"use client";
import { offlineDb, type OutboxItem } from "./db";
import { syncPending } from "./sync-core";
import type { RecordPaymentInput } from "@/server/actions/payments";

export const OUTBOX_EVENT = "ijari:outbox";

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function emit() {
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

/** Queues a payment recorded offline (client_id makes the server write idempotent). */
export async function queueOfflinePayment(input: RecordPaymentInput, meta: OutboxItem["meta"]) {
  const db = await offlineDb();
  const clientId = input.clientId ?? crypto.randomUUID();
  await db.put("outbox", {
    clientId,
    input: { ...input, clientId },
    meta,
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
  });
  emit();
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (
      reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }
    )?.sync?.register("outbox");
  } catch {
    // Background Sync unsupported: we sync on `online`, focus and interval instead.
  }
  return clientId;
}

export async function outboxItems(): Promise<OutboxItem[]> {
  const db = await offlineDb();
  return (await db.getAll("outbox")).sort((a, b) => a.createdAt - b.createdAt);
}

export async function discardOutboxItem(clientId: string) {
  const db = await offlineDb();
  await db.delete("outbox", clientId);
  emit();
}

export async function retryOutboxItem(clientId: string, patch?: Partial<RecordPaymentInput>) {
  const db = await offlineDb();
  const it = await db.get("outbox", clientId);
  if (!it) return;
  await db.put("outbox", {
    ...it,
    input: { ...it.input, ...patch },
    status: "pending",
    error: undefined,
  });
  emit();
}

/** Pushes pending outbox items to the server; see sync-core. */
export async function syncOutbox(): Promise<{ synced: number; review: number }> {
  if (isOffline()) return { synced: 0, review: 0 };
  try {
    return await syncPending();
  } finally {
    emit();
  }
}
