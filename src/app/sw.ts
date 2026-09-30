/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import { offlineDb } from "@/lib/offline/db";
import { syncPending } from "@/lib/offline/sync-core";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const PAGES = "ijari-pages";
const localeOf = (url: string) =>
  new URL(url, self.location.origin).pathname.startsWith("/en") ? "en" : "ar";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // Never cache APIs, auth callbacks, print routes or server actions.
    {
      matcher: ({ url, request, sameOrigin }) =>
        sameOrigin &&
        (url.pathname.startsWith("/api/") ||
          url.pathname.includes("/auth/") ||
          url.pathname.startsWith("/print/") ||
          request.method !== "GET" ||
          request.headers.has("Next-Action")),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "ijari-static",
        plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && /^\/(brand|icons|splash)\//.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "ijari-brand",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/image"),
      handler: new StaleWhileRevalidate({
        cacheName: "ijari-images",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 })],
      }),
    },
    {
      // Supabase Storage (signed URLs): key by path so rotating tokens don't miss the cache.
      matcher: ({ url }) => url.pathname.startsWith("/storage/v1/object/"),
      handler: new StaleWhileRevalidate({
        cacheName: "ijari-storage",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
          {
            cacheKeyWillBeUsed: async ({ request }) =>
              `${new URL(request.url).origin}${new URL(request.url).pathname}`,
          },
        ],
      }),
    },
    // RSC payloads for client navigations: network first, 3s.
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.headers.get("RSC") === "1",
      handler: new NetworkFirst({
        cacheName: "ijari-rsc",
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 })],
      }),
    },
    // Pages: network first (3s) then cache — this is what lets collectors open the collection sheet offline.
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: PAGES,
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 })],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/en/offline",
        matcher: ({ request }) =>
          request.destination === "document" && localeOf(request.url) === "en",
      },
      { url: "/ar/offline", matcher: ({ request }) => request.destination === "document" },
    ],
  },
});

// ---------------------------------------------------------------- update flow
self.addEventListener("message", (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === "SKIP_WAITING") void self.skipWaiting();
});

// ---------------------------------------------------------------- share target (§19.1)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "POST" ||
    url.origin !== self.location.origin ||
    url.pathname !== "/share"
  )
    return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const db = await offlineDb();
      for (const f of form.getAll("files")) {
        if (typeof f === "string") continue;
        await db.put("shared", {
          id: crypto.randomUUID(),
          name: f.name,
          type: f.type,
          size: f.size,
          blob: f,
          receivedAt: Date.now(),
        });
      }
      const client = (await self.clients.matchAll({ type: "window" }))[0];
      const lang = client ? localeOf(client.url) : "ar";
      return Response.redirect(`/${lang}/share`, 303);
    })(),
  );
});

// ---------------------------------------------------------------- background sync (§19.3)
async function syncAndTell() {
  const r = await syncPending();
  for (const c of await self.clients.matchAll({ type: "window" }))
    c.postMessage({ type: "OUTBOX_UPDATED", ...r });
}
self.addEventListener("sync", (event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === "outbox") e.waitUntil(syncAndTell());
});

// ---------------------------------------------------------------- web push (§19.6)
interface PushData {
  title: string;
  body: string;
  url: string;
  tag?: string;
  lang?: "ar" | "en";
  dir?: "rtl" | "ltr";
  type?: string;
  badge?: number;
}

self.addEventListener("push", (event) => {
  let d: PushData;
  try {
    d = event.data?.json() as PushData;
  } catch {
    return;
  }
  const ar = d.lang !== "en";
  const actions = [{ action: "open", title: ar ? "فتح" : "Open" }];
  if (d.type === "tenant_late" || d.type === "daily_digest")
    actions.push({ action: "pay", title: ar ? "سجّل دفعة" : "Record payment" });
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(d.title, {
        body: d.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/monochrome-96.png",
        tag: d.tag,
        lang: d.lang,
        dir: d.dir,
        data: { url: d.url, lang: d.lang ?? "ar" },
        ...({ actions } as object),
      });
      const nav = self.navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void> };
      if (typeof d.badge === "number") await nav.setAppBadge?.(d.badge).catch(() => {});
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as { url?: string; lang?: string };
  const target =
    event.action === "pay" ? `/${data.lang ?? "ar"}/collections` : (data.url ?? "/ar/dashboard");
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = all.find((c) => new URL(c.url).origin === self.location.origin) as
        WindowClient | undefined;
      if (existing) {
        await existing.focus();
        await existing
          .navigate(target)
          .catch(() => existing.postMessage({ type: "NAVIGATE", url: target }));
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  const e = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
  };
  e.waitUntil(
    (async () => {
      const key = e.oldSubscription?.options.applicationServerKey;
      const sub =
        e.newSubscription ??
        (key
          ? await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key,
            })
          : null);
      if (e.oldSubscription)
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: e.oldSubscription.endpoint }),
        }).catch(() => {});
      if (sub)
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), locale: "ar" }),
        }).catch(() => {});
    })(),
  );
});

serwist.addEventListeners();
