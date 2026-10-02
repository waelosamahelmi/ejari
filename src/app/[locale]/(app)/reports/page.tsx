import {
  BarChart3,
  CalendarClock,
  CalendarRange,
  DoorOpen,
  FileClock,
  FileText,
  HandCoins,
  ReceiptText,
  UserRound,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { IconTile, type Tone } from "@/components/ui/icon-tile";
import { REPORT_TYPES, type ReportType } from "@/server/reports/build";

const META: Record<ReportType, { icon: typeof FileText; tone: Tone }> = {
  statement: { icon: FileText, tone: "ink" },
  summary: { icon: HandCoins, tone: "green" },
  late: { icon: FileClock, tone: "red" },
  vacant: { icon: DoorOpen, tone: "gray" },
  accounting: { icon: BarChart3, tone: "gulf" },
  owner: { icon: UserRound, tone: "rose" },
  ledger: { icon: ReceiptText, tone: "indigo" },
  expiring: { icon: CalendarClock, tone: "orange" },
  expenses: { icon: Wallet, tone: "sand" },
  grace: { icon: CalendarRange, tone: "teal" },
};

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "reports" });
  return { title: t("title") };
}

export default async function ReportsHub({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_late_units" });
  const t = await getTranslations("reports");
  const types = REPORT_TYPES.filter((x) => can(ctx.role, "view_reports") || x === "late");
  return (
    <>
      <LargeTitleHeader title={t("title")} subtitle={t("subtitle")} />
      <ul data-tour="reports-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map((k) => {
          const M = META[k];
          return (
            <li key={k}>
              <Link
                href={`/reports/${k}`}
                className="card press flex h-full items-start gap-4 p-5 hover:shadow-[var(--sh-float)]"
              >
                <IconTile tone={M.tone} size="lg">
                  <M.icon />
                </IconTile>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold">{t(`types.${k}.title`)}</h2>
                  <p className="text-label-2 mt-0.5 text-[14px] leading-5">
                    {t(`types.${k}.desc`)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
