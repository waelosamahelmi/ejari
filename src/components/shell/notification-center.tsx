"use client";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { lazySupabase, whenIdle } from "@/lib/supabase/lazy-client";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { diffDays, todayKuwait } from "@/domain/dates";
import { useSession } from "./prefs-context";

export interface NotificationRow {
  id: string;
  type: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

export type NotificationFilter = "all" | "payments" | "late" | "contracts" | "other";
// The list (with swipe-to-dismiss via motion) loads only when the sheet is opened.
const NotificationList = dynamic(
  () => import("./notification-list").then((m) => m.NotificationList),
  { ssr: false },
);

const FILTER_TYPES: Record<Exclude<NotificationFilter, "all" | "other">, string[]> = {
  payments: ["payment_recorded", "offline_synced", "offline_review", "deposit_recorded"],
  late: ["tenant_late", "daily_digest", "hearing_tomorrow"],
  contracts: ["contract_expiring", "notice_recorded", "grace_ending", "unit_vacant"],
};

function setBadge(n: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (n > 0) nav.setAppBadge?.(n).catch(() => {});
  else nav.clearAppBadge?.().catch(() => {});
}

/** Round glass bell + in-app notification center (grouped, filters, live via Realtime). */
export function NotificationBell({ variant = "plain" }: { variant?: "plain" | "glass" }) {
  const t = useTranslations("notifications");
  const tA11y = useTranslations("common.a11y");
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const instance = useId().replace(/:/g, "");

  const load = useCallback(async () => {
    const supabase = await lazySupabase();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title_ar, title_en, body_ar, body_en, url, read_at, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    // Load the list and subscribe once the page is idle: keeps Supabase out of the first paint.
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      void load();
      void lazySupabase().then((supabase) => {
        if (cancelled) return;
        const channel = supabase
          .channel(`notifications:${session.userId}:${instance}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${session.userId}`,
            },
            () => void load(),
          )
          .subscribe();
        cleanup = () => void supabase.removeChannel(channel);
      });
    });
    return () => {
      cancelled = true;
      cancelIdle();
      cleanup?.();
    };
  }, [load, session.userId, instance]);

  const unread = rows.filter((r) => !r.read_at).length;
  useEffect(() => setBadge(unread), [unread]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "other") {
      const known = new Set(Object.values(FILTER_TYPES).flat());
      return rows.filter((r) => !known.has(r.type));
    }
    return rows.filter((r) => FILTER_TYPES[filter].includes(r.type));
  }, [rows, filter]);

  const today = todayKuwait();
  const groups = useMemo(() => {
    const g: Record<"today" | "week" | "earlier", NotificationRow[]> = {
      today: [],
      week: [],
      earlier: [],
    };
    for (const r of filtered) {
      const d = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kuwait" });
      const days = diffDays(d, today);
      (days <= 0 ? g.today : days < 7 ? g.week : g.earlier).push(r);
    }
    return g;
  }, [filtered, today]);

  const markAll = async () => {
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (!ids.length) return;
    setRows((rs) => rs.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
    await (
      await lazySupabase()
    )
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
  };
  const openRow = async (r: NotificationRow) => {
    if (!r.read_at) {
      setRows((rs) =>
        rs.map((x) => (x.id === r.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      await (
        await lazySupabase()
      )
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", r.id);
    }
    if (r.url) {
      setOpen(false);
      router.push(r.url.replace(/^\/(ar|en)(?=\/)/, ""));
    }
  };
  const dismiss = async (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    await (
      await lazySupabase()
    )
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString(), read_at: new Date().toISOString() })
      .eq("id", id);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${tA11y("notifications")}${unread ? ` (${unread})` : ""}`}
        className={cn(
          "press relative flex size-10 items-center justify-center rounded-full",
          variant === "glass"
            ? "glass text-white"
            : "bg-paper text-label shadow-[0_1px_3px_rgba(16,24,40,.08)]",
        )}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="bg-red num absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={t("title")} size="md">
        <NotificationList
          rows={filtered}
          groups={groups}
          filter={filter}
          setFilter={setFilter}
          unread={unread}
          markAll={markAll}
          openRow={openRow}
          dismiss={dismiss}
        />
      </Sheet>
    </>
  );
}
