import { getTranslations } from "next-intl/server";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { pageLocale, type LocaleParams } from "@/lib/i18n";

export default async function DashboardPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("nav");
  return <LargeTitleHeader title={t("dashboard")} />;
}
