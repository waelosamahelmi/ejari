"use client";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/sheet";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { diffDays, todayKuwait } from "@/domain/dates";
import { useSession } from "./prefs-context";
import { NotificationsIllustration } from "@/components/illustrations";
import { gentle } from "@/lib/motion";

interface Row {
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

type Filter = "all" | "payments" | "late" | "contracts" | "other";
const FILTER_TYPES: Record<Exclude<Filter, "all" | "other">, string[]> = {
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
  const locale = useLocale();
  const router = useRouter();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const instance = useId().replace(/:/g, "");

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title_ar, title_en, body_ar, body_en, url, read_at, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    void load();
    const supabase = supabaseBrowser();
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
    return () => {
      void supabase.removeChannel(channel);
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
    const g: Record<"today" | "week" | "earlier", Row[]> = { today: [], week: [], earlier: [] };
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
    await supabaseBrowser()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
  };
  const openRow = async (r: Row) => {
    if (!r.read_at) {
      setRows((rs) =>
        rs.map((x) => (x.id === r.id ? { ...x, read_at: new Date().toISOString() } : x)),
      );
      await supabaseBrowser()
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
    await supabaseBrowser()
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <ChipScroller className="flex-1">
            {(["all", "payments", "late", "contracts", "other"] as const).map((f) => (
              <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {t(`filters.${f}`)}
              </Chip>
            ))}
          </ChipScroller>
        </div>
        {unread > 0 && (
          <div className="mb-2 flex justify-end">
            <Button variant="plain" size="sm" onClick={markAll}>
              <CheckCheck />
              {t("markAllRead")}
            </Button>
          </div>
        )}
        {filtered.length === 0 ? (
          <EmptyState
            compact
            illustration={<NotificationsIllustration />}
            title={t("empty")}
            description={t("emptyText")}
          />
        ) : (
          <div className="space-y-5">
            {(["today", "week", "earlier"] as const).map((g) =>
              groups[g].length ? (
                <section key={g}>
                  <h3 className="text-label-2 px-1 pb-2 text-[13px] font-medium">
                    {t(`groups.${g}`)}
                  </h3>
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {groups[g].map((r) => (
                        <motion.li
                          key={r.id}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={gentle}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.5}
                          onDragEnd={(_, info) => {
                            if (Math.abs(info.offset.x) > 120) void dismiss(r.id);
                          }}
                          className="bg-paper relative overflow-hidden rounded-[18px] shadow-[var(--sh-card)]"
                        >
                          <button
                            type="button"
                            onClick={() => void openRow(r)}
                            className="flex w-full gap-3 p-4 pe-11 text-start"
                          >
                            <span
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full",
                                r.read_at ? "bg-transparent" : "bg-gulf",
                              )}
                              aria-label={r.read_at ? undefined : t("unread")}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-semibold">
                                {locale === "ar" ? r.title_ar : r.title_en}
                              </span>
                              <span className="text-label-2 mt-0.5 block text-[14px] leading-5">
                                {locale === "ar" ? r.body_ar : r.body_en}
                              </span>
                              <span className="text-label-3 num mt-1 block text-[12px]">
                                {new Date(r.created_at).toLocaleString(
                                  locale === "ar" ? "ar-KW-u-nu-latn" : "en-GB",
                                  {
                                    timeZone: "Asia/Kuwait",
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  },
                                )}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={t("dismiss")}
                            onClick={() => void dismiss(r.id)}
                            className="text-label-3 hover:text-label absolute end-3 top-3 flex size-7 items-center justify-center rounded-full"
                          >
                            <X className="size-4" />
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
