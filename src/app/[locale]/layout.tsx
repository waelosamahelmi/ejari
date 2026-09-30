import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { inter, plexArabic } from "@/lib/fonts";
import { THEME_SCRIPT } from "@/components/shell/theme";
import { Toaster } from "@/components/ui/toaster";
import { SPLASH_SCREENS } from "@/config/generated-assets";
import { PUBLIC_ENV } from "@/lib/env";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "common.app" });
  return {
    metadataBase: new URL(PUBLIC_ENV.appUrl),
    title: { default: t("fullName"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("fullName"),
    appleWebApp: {
      capable: true,
      title: "إيجاري",
      statusBarStyle: "black-translucent",
      startupImage: SPLASH_SCREENS.map((s) => ({ url: s.href, media: s.media })),
    },
    formatDetection: { telephone: false },
    alternates: { languages: { ar: "/ar", en: "/en" } },
    other: { "mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ECEEF2" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0D" },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const store = await cookies();
  const theme = store.get("ijari-theme")?.value ?? "system";
  const accent = store.get("ijari-accent")?.value ?? "ink";
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={theme === "dark" ? "dark" : undefined}
      data-theme={theme}
      data-accent={accent}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${plexArabic.variable} ${inter.variable}`}>
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
