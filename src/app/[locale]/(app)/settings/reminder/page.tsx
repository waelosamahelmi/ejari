import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { RulesForm } from "../rules-form";

export default async function ReminderPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "send_reminder" });
  const t = await getTranslations("settings.items");
  return <RulesForm mode="reminder" title={t("reminder")} settings={ctx.settings} />;
}
