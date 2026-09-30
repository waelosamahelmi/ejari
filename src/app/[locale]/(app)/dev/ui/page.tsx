import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { Gallery } from "./gallery";

export const metadata = { title: "UI" };

export default async function DevUiPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await getSessionContext();
  if (ctx?.role !== "admin") redirect(`/${locale}/forbidden`);
  return <Gallery />;
}
