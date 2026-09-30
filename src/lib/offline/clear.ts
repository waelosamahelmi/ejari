/** On sign-out: clear caches, IndexedDB and this device's push subscription (§19.2). */
export async function clearClientData() {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    }
    if ("caches" in window) {
      for (const k of await caches.keys()) await caches.delete(k);
    }
    if ("indexedDB" in window && indexedDB.databases) {
      for (const db of await indexedDB.databases()) if (db.name?.startsWith("ijari")) indexedDB.deleteDatabase(db.name);
    }
    try {
      localStorage.removeItem("ijari-offline-meta");
    } catch {}
  } catch {
    // best effort
  }
}
