"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { OUTBOX_EVENT, outboxItems, syncOutbox } from "@/lib/offline/outbox-client";
import type { OutboxItem } from "@/lib/offline/db";
import { isIOS, isStandalone } from "@/lib/push/client";
import { ConnectivityPill } from "./connectivity-pill";
import { UpdateBanner } from "./update-banner";
import { OutboxSheet } from "./outbox-sheet";
import { PushPrompt } from "./push-prompt";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  online: boolean;
  outbox: OutboxItem[];
  openOutbox: () => void;
  canInstall: boolean;
  promptInstall: () => Promise<boolean>;
  standalone: boolean;
  ios: boolean;
  /** Number of app sessions on this device (install UI starts from the 2nd). */
  sessions: number;
}

const Ctx = createContext<PwaState | null>(null);

export function usePwa(): PwaState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePwa outside PwaProvider");
  return v;
}

/** Pages refreshed into the offline cache for collectors (§19.3). */
const OFFLINE_ROUTES = ["/collections", "/reports/late", "/dashboard"];
const PAGES_CACHE = "ijari-pages";

function countSession(): number {
  try {
    let n = Number(localStorage.getItem("ijari-sessions") ?? "0");
    if (!sessionStorage.getItem("ijari-session")) {
      sessionStorage.setItem("ijari-session", "1");
      n += 1;
      localStorage.setItem("ijari-sessions", String(n));
    }
    return n;
  } catch {
    return 1;
  }
}

export function PwaProvider({
  children,
  offlineRoutes = OFFLINE_ROUTES,
}: {
  children: ReactNode;
  offlineRoutes?: string[];
}) {
  const t = useTranslations("pwa.pill");
  const locale = useLocale();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [sheet, setSheet] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [sessions, setSessions] = useState(1);
  const lastOnline = useRef(true);
  const updateRequested = useRef(false);

  const refreshOutbox = useCallback(async () => {
    try {
      setOutbox(await outboxItems());
    } catch {
      setOutbox([]);
    }
  }, []);

  const sync = useCallback(async () => {
    const r = await syncOutbox();
    if (r.synced) toast.success(t("synced", { count: r.synced }));
    if (r.synced) router.refresh();
  }, [router, t]);

  /** Refreshes the offline copies of the collector's key screens. */
  const warmOfflineCache = useCallback(async () => {
    if (!navigator.onLine || !("caches" in window) || !navigator.serviceWorker?.controller) return;
    try {
      const cache = await caches.open(PAGES_CACHE);
      await Promise.all(
        offlineRoutes.map(async (r) => {
          const url = `/${locale}${r}`;
          const res = await fetch(url, {
            credentials: "same-origin",
            headers: { accept: "text/html" },
          });
          if (res.ok && !res.redirected) await cache.put(url, res);
        }),
      );
    } catch {
      // best effort
    }
  }, [locale, offlineRoutes]);

  useEffect(() => {
    setOnline(navigator.onLine);
    lastOnline.current = navigator.onLine;
    setStandalone(isStandalone());
    setIos(isIOS());
    setSessions(countSession());
    void refreshOutbox();

    const onOnline = () => {
      setOnline(true);
      if (!lastOnline.current) toast(t("backOnline"));
      lastOnline.current = true;
      void sync();
    };
    const onOffline = () => {
      setOnline(false);
      lastOnline.current = false;
    };
    const onFocus = () => {
      if (!navigator.onLine) return;
      void sync();
      void warmOfflineCache();
    };
    const onOutbox = () => void refreshOutbox();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvt(null);
      setStandalone(true);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onFocus);
    window.addEventListener(OUTBOX_EVENT, onOutbox);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const tick = window.setInterval(
      () => {
        void sync();
        void warmOfflineCache();
      },
      10 * 60 * 1000,
    );
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(OUTBOX_EVENT, onOutbox);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearInterval(tick);
    };
  }, [refreshOutbox, sync, warmOfflineCache, t]);

  // Service worker: register (production build only), watch for updates, relay messages.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reg: ServiceWorkerRegistration | undefined;
    const track = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const w = r.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) setWaiting(w);
        });
      });
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        reg = r;
        track(r);
        void navigator.serviceWorker.ready.then(() => {
          void sync();
          void warmOfflineCache();
        });
      })
      .catch(() => {});
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string; synced?: number } | null;
      if (d?.type === "OUTBOX_UPDATED") {
        void refreshOutbox();
        if (d.synced) {
          toast.success(t("synced", { count: d.synced }));
          router.refresh();
        }
      }
      if (d?.type === "NAVIGATE" && d.url) window.location.href = d.url;
    };
    let reloading = false;
    const onController = () => {
      // Only reload for an update the user asked for (never on first install, never mid-form).
      if (reloading || !updateRequested.current) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    const check = window.setInterval(() => void reg?.update().catch(() => {}), 30 * 60 * 1000);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      window.clearInterval(check);
    };
  }, [refreshOutbox, router, sync, warmOfflineCache, t]);

  const promptInstall = useCallback(async () => {
    if (!installEvt) return false;
    await installEvt.prompt();
    const choice = await installEvt.userChoice;
    setInstallEvt(null);
    return choice.outcome === "accepted";
  }, [installEvt]);

  const value = useMemo<PwaState>(
    () => ({
      online,
      outbox,
      openOutbox: () => setSheet(true),
      canInstall: !!installEvt && !standalone,
      promptInstall,
      standalone,
      ios,
      sessions,
    }),
    [online, outbox, installEvt, standalone, promptInstall, ios, sessions],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ConnectivityPill online={online} outbox={outbox} onOpen={() => setSheet(true)} />
      {waiting && (
        <UpdateBanner
          onReload={() => {
            updateRequested.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }}
          onLater={() => setWaiting(null)}
        />
      )}
      <PushPrompt />
      <OutboxSheet
        open={sheet}
        onOpenChange={setSheet}
        items={outbox}
        online={online}
        onSync={sync}
      />
    </Ctx.Provider>
  );
}
