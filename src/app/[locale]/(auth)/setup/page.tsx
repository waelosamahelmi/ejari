import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAuthUser, getSessionContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { SetupWizard } from "./setup-wizard";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "setup" });
  return { title: t("title") };
}

export default async function SetupPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const user = await getAuthUser();
  if (!user) redirect(`/${locale}/login`);
  const ctx = await getSessionContext();
  if (ctx) redirect(`/${locale}/${ctx.role === "owner" ? "owner" : "dashboard"}`);
  const name = user.name.trim() || user.email.split("@")[0] || "";
  return <SetupWizard userName={name} defaultLocale={locale as "ar" | "en"} />;
}
