import { redirect } from "next/navigation";
import { pageLocale, type LocaleParams } from "@/lib/i18n";

/** Legacy route for office-less accounts: the first-run wizard owns this flow now. */
export default async function NoOrgPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  redirect(`/${locale}/setup`);
}
