import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { signPath } from "@/server/storage";
import { OrgForm } from "./org-form";

export default async function OrgSettingsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "manage_org" });
  const t = await getTranslations("settings.items");
  return <OrgForm title={t("org")} name={ctx.orgName} nameEn={ctx.orgNameEn} logoUrl={ctx.orgLogo ? await signPath("branding", ctx.orgLogo) : null} letterhead={ctx.settings.letterhead} poweredBy={ctx.settings.poweredBy} accent={ctx.prefs.accent} />;
}
