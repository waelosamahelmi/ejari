import "server-only";
import { setRequestLocale } from "next-intl/server";

export type AppLocale = "ar" | "en";
export type LocaleParams<T = object> = { params: Promise<{ locale: string } & T> };

/** Resolves the route locale and enables static rendering for next-intl. */
export async function pageLocale<T extends { locale: string }>(params: Promise<T>): Promise<T & { locale: AppLocale }> {
  const p = await params;
  const locale: AppLocale = p.locale === "en" ? "en" : "ar";
  setRequestLocale(locale);
  return { ...p, locale };
}
