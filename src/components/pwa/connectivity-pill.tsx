"use client";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OutboxItem } from "@/lib/offline/db";
import { useNum } from "@/components/shell/prefs-context";
import { cn } from "@/lib/utils";

/** Glass connectivity / sync-state pill at the top of the screen (§19.3). */
export function ConnectivityPill({
  online,
  outbox,
  onOpen,
}: {
  online: boolean;
  outbox: OutboxItem[];
  onOpen: () => void;
}) {
  const t = useTranslations("pwa.pill");
  const num = useNum();
  const review = outbox.filter((i) => i.status === "review").length;
  const waiting = outbox.length - review;
  if (online && outbox.length === 0) return null;
  const tone = !online ? "offline" : review ? "review" : "syncing";
  const label = !online
    ? t("offline", { count: waiting })
    : review
      ? t("review", { count: review })
      : t("syncing", { count: waiting });
  const Icon = tone === "offline" ? CloudOff : tone === "review" ? TriangleAlert : RefreshCw;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+8px)] z-[70] flex justify-center px-4">
      <button
        type="button"
        onClick={onOpen}
        aria-live="polite"
        className={cn(
          "press animate-in fade-in slide-in-from-top-2 pointer-events-auto flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white shadow-[var(--sh-float)] backdrop-blur-xl",
          tone === "review"
            ? "bg-[color-mix(in_srgb,var(--orange)_88%,black)]"
            : "bg-[rgba(14,15,18,.86)]",
        )}
      >
        <Icon
          className={cn("size-4", tone === "syncing" && "motion-safe:animate-spin")}
          aria-hidden
        />
        <span>{label.replace(/\d+/g, (d) => num(Number(d)))}</span>
      </button>
    </div>
  );
}
