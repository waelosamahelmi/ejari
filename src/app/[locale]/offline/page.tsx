import { getTranslations, setRequestLocale } from "next-intl/server";
import { Banknote, CalendarClock, HandCoins, History, MessageCircle } from "lucide-react";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { OfflineIllustration } from "@/components/illustrations";
import { OfflineActions } from "./offline-actions";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "pwa.offline" });
  return { title: t("title") };
}

/** Branded offline fallback (precached by the service worker). */
export default async function OfflinePage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations("pwa.offline");
  const works = [
    { key: "collections", icon: HandCoins },
    { key: "payment", icon: Banknote },
    { key: "late", icon: CalendarClock },
    { key: "quick", icon: History },
    { key: "reminders", icon: MessageCircle },
  ] as const;
  return (
    <main className="bg-mist grid min-h-dvh place-items-center px-4 py-[max(2.5rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-[440px] text-center">
        <div className="mx-auto mb-6 w-48">
          <OfflineIllustration />
        </div>
        <h1 className="text-[28px] leading-tight font-semibold">{t("title")}</h1>
        <p className="text-label-2 mx-auto mt-2 max-w-[36ch] text-[16px] leading-7">{t("text")}</p>
        <section className="bg-paper mt-7 rounded-[28px] p-5 text-start shadow-[var(--sh-card)]">
          <h2 className="text-label-2 mb-3 text-[13px] font-semibold">{t("worksTitle")}</h2>
          <ul className="space-y-3">
            {works.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-3 text-[15px]">
                <span className="bg-inset flex size-9 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                {t(`works.${key}`)}
              </li>
            ))}
          </ul>
        </section>
        <OfflineActions retry={t("retry")} openCollections={t("openCollections")} locale={locale} />
      </div>
    </main>
  );
}
