import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { PreferencesForm } from "./preferences-form";

export default async function PreferencesPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const t = await getTranslations("settings.items");
  return (
    <PreferencesForm
      title={t("preferences")}
      prefs={{ theme: ctx.prefs.theme, digits: ctx.prefs.digits, density: ctx.prefs.density }}
    />
  );
}
