import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { dashboardData } from "@/server/queries/dashboard";
import { isValidPeriod, periodOf, todayKuwait } from "@/domain/dates";
import { DashboardView } from "./dashboard-view";
import { WIDGETS, type Layout, type WidgetKey } from "./widgets-config";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "dashboard" });
  return { title: t("title") };
}

function parseLayout(raw: unknown): Layout {
  const r = (raw && typeof raw === "object" ? raw : {}) as { order?: string[]; hidden?: string[] };
  const valid = (x: string): x is WidgetKey => (WIDGETS as readonly string[]).includes(x);
  return { order: (r.order ?? [...WIDGETS]).filter(valid), hidden: (r.hidden ?? []).filter(valid) };
}

export default async function DashboardPage({ params, searchParams }: LocaleParams & { searchParams: Promise<{ period?: string; property?: string; owner?: string }> }) {
  const { locale } = await pageLocale(params);
  const sp = await searchParams;
  const ctx = await requireContext(locale);
  const today = todayKuwait();
  const period = sp.period && isValidPeriod(sp.period) ? sp.period : periodOf(today);
  const filters = { propertyId: sp.property ?? null, ownerId: sp.owner ?? null };
  const d = await dashboardData(ctx, { period, ...filters }, today);
  return <DashboardView d={d} layout={parseLayout(ctx.prefs.dashboardLayout)} filters={filters} />;
}
