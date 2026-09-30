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

/** A file received through the PWA share target, waiting to be attached. */
export interface SharedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  receivedAt: number;
}

interface Schema extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { status: string } };
  snapshots: { key: string; value: OfflineSnapshot };
  shared: { key: string; value: SharedFile };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function offlineDb() {
  dbp ??= openDB<Schema>("ijari-offline", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const outbox = db.createObjectStore("outbox", { keyPath: "clientId" });
        outbox.createIndex("status", "status");
        db.createObjectStore("snapshots", { keyPath: "key" });
      }
      if (oldVersion < 2) db.createObjectStore("shared", { keyPath: "id" });
    },
  });
  return dbp;
}
