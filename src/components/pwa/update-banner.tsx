"use client";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/** "Update available — Reload" glass banner. Reload only happens when the user taps it. */
export function UpdateBanner({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  const t = useTranslations("pwa.update");
  return (
    <div
      role="status"
      className="animate-in fade-in slide-in-from-bottom-3 fixed inset-x-0 bottom-[calc(var(--safe-bottom)+96px)] z-[70] flex justify-center px-4 lg:bottom-6"
    >
      <div className="flex items-center gap-2 rounded-full bg-[rgba(14,15,18,.9)] py-1.5 ps-4 pe-1.5 text-white shadow-[var(--sh-float)] backdrop-blur-xl">
        <Sparkles className="size-4 text-[var(--brand-sand)]" aria-hidden />
        <span className="text-[14px] font-medium">{t("text")}</span>
        <button
          type="button"
          onClick={onLater}
          className="press min-h-9 rounded-full px-3 text-[13px] text-white/70"
        >
          {t("later")}
        </button>
        <button
          type="button"
          onClick={onReload}
          className="press min-h-9 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0E0F12]"
        >
          {t("reload")}
        </button>
      </div>
    </div>
  );
}
