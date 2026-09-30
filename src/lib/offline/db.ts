import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { RecordPaymentInput } from "@/server/actions/payments";

export interface OutboxItem {
  clientId: string;
  input: RecordPaymentInput;
  meta: { tenantName: string; unitLabels: string; propertyName: string };
  createdAt: number;
  status: "pending" | "syncing" | "review";
  error?: string;
  attempts: number;
}

export interface OfflineSnapshot {
  key: string;
  savedAt: number;
  data: unknown;
}

interface Schema extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { status: string } };
  snapshots: { key: string; value: OfflineSnapshot };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function offlineDb() {
  dbp ??= openDB<Schema>("ijari-offline", 1, {
    upgrade(db) {
      const outbox = db.createObjectStore("outbox", { keyPath: "clientId" });
      outbox.createIndex("status", "status");
      db.createObjectStore("snapshots", { keyPath: "key" });
    },
  });
  return dbp;
}
