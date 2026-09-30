import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { RulesForm } from "../rules-form";

export default async function NumberingPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "manage_org" });
  const t = await getTranslations("settings.items");
  return <RulesForm mode="numbering" title={t("numbering")} settings={ctx.settings} />;
}
