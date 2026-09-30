import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { RulesForm } from "../rules-form";

export default async function BillingPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "manage_master_data" });
  const t = await getTranslations("settings.items");
  return <RulesForm mode="billing" title={t("billing")} settings={ctx.settings} />;
}
