import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { BeneficiariesView } from "./beneficiaries-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as "ar" | "en",
    namespace: "catalog.beneficiaries",
  });
  return { title: t("title") };
}

export default async function BeneficiariesPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  await requireContext(locale, { capability: "manage_expenses" });
  const db = await supabaseServer();
  const { data } = await db
    .from("beneficiaries")
    .select("id, name, kind, phone, monthly_salary_fils, notes, active")
    .order("name");
  return (
    <BeneficiariesView
      rows={(data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        kind: b.kind,
        phone: b.phone ?? "",
        monthlySalaryFils: b.monthly_salary_fils,
        notes: b.notes ?? "",
        active: b.active,
      }))}
    />
  );
}
