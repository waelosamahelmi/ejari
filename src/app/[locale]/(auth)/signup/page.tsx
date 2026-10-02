import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthFrame } from "@/components/domain/auth-frame";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { SignupForm } from "./signup-form";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "auth.signup" });
  return { title: t("title") };
}

export default async function SignupPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  if (process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "false") redirect(`/${locale}/login`);
  const t = await getTranslations("auth.signup");
  return (
    <AuthFrame
      headline={t("headline")}
      strong={t("strong")}
      subtitle={t("subtitle")}
      lockupAlt=""
    >
      <SignupForm />
    </AuthFrame>
  );
}
