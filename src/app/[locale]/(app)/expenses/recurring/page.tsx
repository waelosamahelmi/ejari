import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { voucherFormOptions } from "@/server/queries/expenses";
import { periodOf, todayKuwait } from "@/domain/dates";
import { RecurringView } from "./recurring-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as "ar" | "en",
    namespace: "expenses.recurringPage",
  });
  return { title: t("title") };
}

export default async function RecurringPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "manage_expenses" });
  const db = await supabaseServer();
  const { data } = await db
    .from("recurring_expenses")
    .select("*, expense_categories(name_ar, name_en), beneficiaries(name)")
    .order("created_at");
  const opts = await voucherFormOptions(ctx);
  return (
    <RecurringView
      period={periodOf(todayKuwait())}
      options={opts}
      rows={(data ?? []).map((r) => {
        const alloc = r.allocation as { mode: string; targets: { propertyId: string }[] };
        return {
          id: r.id,
          categoryId: r.category_id,
          category: (r.expense_categories as unknown as { name_ar: string; name_en: string })[
            locale === "ar" ? "name_ar" : "name_en"
          ],
          beneficiaryId: r.beneficiary_id,
          beneficiary: (r.beneficiaries as unknown as { name: string } | null)?.name ?? "",
          amountFils: r.amount_fils,
          description: r.description,
          mode: alloc.mode,
          propertyIds: alloc.targets.map((x) => x.propertyId),
          dayOfMonth: r.day_of_month,
          lastPeriod: r.last_generated_period,
          active: r.active,
        };
      })}
    />
  );
}
