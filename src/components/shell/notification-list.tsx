"use client";
import { AnimatePresence, m } from "motion/react";
import { CheckCheck, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { NotificationsIllustration } from "@/components/illustrations";
import { gentle } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { NotificationFilter, NotificationRow } from "./notification-center";

/** Notification center list: filters, Today / This week / Earlier, swipe or tap × to dismiss. */
export function NotificationList({
  rows: filtered,
  groups,
  filter,
  setFilter,
  unread,
  markAll,
  openRow,
  dismiss,
}: {
  rows: NotificationRow[];
  groups: Record<"today" | "week" | "earlier", NotificationRow[]>;
  filter: NotificationFilter;
  setFilter: (f: NotificationFilter) => void;
  unread: number;
  markAll: () => Promise<void> | void;
  openRow: (r: NotificationRow) => Promise<void> | void;
  dismiss: (id: string) => Promise<void> | void;
}) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  return (
    <>
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
                      <m.li
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
                            role={r.read_at ? undefined : "img"}
                            aria-hidden={r.read_at ? true : undefined}
                            aria-label={r.read_at ? undefined : t("unread")}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold">
                              {locale === "ar" ? r.title_ar : r.title_en}
                            </span>
                            <span className="text-label-2 mt-0.5 block text-[14px] leading-5">
                              {locale === "ar" ? r.body_ar : r.body_en}
                            </span>
                            <span className="text-label-2 num mt-1 block text-[12px]">
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
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ) : null,
          )}
        </div>
      )}
    </>
  );
}
