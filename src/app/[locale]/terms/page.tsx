import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/domain/legal-page";
import { pageLocale, type LocaleParams } from "@/lib/i18n";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "policy.terms" });
  return { title: t("title") };
}

export default async function TermsPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("policy");
  const tp = await getTranslations("policy.terms");
  const sections = tp.raw("sections") as { title: string; body: string }[];
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@ejarikw.com";
  return (
    <LegalPage
      back={t("back")}
      title={tp("title")}
      updated={t("updated", { date: "02/10/2026" })}
      intro={tp("intro")}
      sections={sections}
      contactTitle={tp("contactTitle")}
      contact={tp("contact", { email })}
    />
  );
}
