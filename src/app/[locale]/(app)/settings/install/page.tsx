import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { InstallView } from "./install-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "settings.items" });
  return { title: t("install") };
}

export default async function InstallPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  await requireContext(locale);
  return <InstallView />;
}
