import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { CategoriesView } from "./categories-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as "ar" | "en",
    namespace: "catalog.categories",
  });
  return { title: t("title") };
}

export default async function CategoriesPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  await requireContext(locale, { capability: "manage_expenses" });
  const db = await supabaseServer();
  const { data } = await db
    .from("expense_categories")
    .select("id, name_ar, name_en, type, active")
    .order("name_ar");
  return (
    <CategoriesView
      rows={(data ?? []).map((c) => ({
        id: c.id,
        nameAr: c.name_ar,
        nameEn: c.name_en,
        type: c.type,
        active: c.active,
      }))}
    />
  );
}
