import { pageLocale } from "@/lib/i18n";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthFrame } from "@/components/domain/auth-frame";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "auth.login" });
  return { title: t("title") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  const t = await getTranslations("onboarding");
  const tApp = await getTranslations("common.app");
  const slide = t.raw("slides") as { title: string; strong: string; subtitle: string }[];
  return (
    <AuthFrame
      headline={slide[0]!.title}
      strong={slide[0]!.strong}
      subtitle={slide[0]!.subtitle}
      lockupAlt={tApp("fullName")}
    >
      <Suspense>
        <LoginForm
          showDemo={process.env.NEXT_PUBLIC_DEMO_ACCOUNTS !== "0"}
          showSignup={process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false"}
        />
      </Suspense>
    </AuthFrame>
  );
}
