import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { ShareInbox } from "./share-inbox";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "pwa.share" });
  return { title: t("title") };
}

export default async function SharePage({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ unsupported?: string }> }) {
  const { locale } = await pageLocale(params);
  await requireContext(locale, { capability: "record_payment" });
  const sp = await searchParams;
  return <ShareInbox unsupported={sp.unsupported === "1"} />;
}
