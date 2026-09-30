import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import {
  buildReport,
  paramsToQuery,
  parseParams,
  reportOptions,
  REPORT_TYPES,
  type ReportType,
} from "@/server/reports/build";
import { ReportView } from "@/components/domain/reports/report-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, type } = await params;
  if (!(REPORT_TYPES as readonly string[]).includes(type)) return {};
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "reports" });
  return { title: t(`types.${type as ReportType}.title`) };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale, type } = await pageLocale(params);
  if (!(REPORT_TYPES as readonly string[]).includes(type)) notFound();
  const ctx = await requireContext(locale, { capability: "view_late_units" });
  if (type !== "late" && !can(ctx.role, "view_reports")) redirect(`/${locale}/forbidden`);
  const sp = await searchParams;
  const p = parseParams(sp);
  const [spec, options] = await Promise.all([
    buildReport(ctx, type as ReportType, p, locale),
    reportOptions(ctx),
  ]);
  return (
    <ReportView
      spec={spec}
      params={p}
      query={paramsToQuery(p)}
      options={options}
      canRemind={can(ctx.role, "send_reminder")}
    />
  );
}
