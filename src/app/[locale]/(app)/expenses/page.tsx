import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAll } from "@/server/db";
import { can } from "@/lib/permissions";
import { ExpensesView } from "./expenses-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "expenses" });
  return { title: t("title") };
}

export default async function ExpensesPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_expenses" });
  const db = await supabaseServer();
  const rows = await fetchAll((f, t) =>
    db
      .from("expense_vouchers")
      .select("id, voucher_no, voucher_date, recipient_name, status, expense_lines(amount_fils, description, category_id, beneficiaries(name), expense_categories(name_ar, name_en), expense_allocations(property_id, properties(name)))")
      .order("voucher_date", { ascending: false })
      .range(f, t),
  );
  const { data: cats } = await db.from("expense_categories").select("id, name_ar, name_en").order("name_ar");
  const { data: props } = await db.from("properties").select("id, name").order("name");
  return (
    <ExpensesView
      canCreate={can(ctx.role, "manage_expenses")}
      categories={(cats ?? []).map((c) => ({ id: c.id, name: locale === "ar" ? c.name_ar : c.name_en }))}
      properties={props ?? []}
      rows={rows.map((v) => {
        const lines = v.expense_lines ?? [];
        const propNames = new Map<string, string>();
        for (const l of lines) for (const a of l.expense_allocations ?? []) propNames.set(a.property_id, (a.properties as unknown as { name: string }).name);
        return {
          id: v.id,
          no: v.voucher_no,
          date: v.voucher_date,
          recipient: v.recipient_name ?? "",
          status: v.status,
          total: lines.reduce((a, l) => a + l.amount_fils, 0),
          lines: lines.map((l) => [(l.expense_categories as unknown as { name_ar: string; name_en: string })[locale === "ar" ? "name_ar" : "name_en"], l.description, (l.beneficiaries as unknown as { name: string } | null)?.name].filter(Boolean).join(" · ")),
          categoryIds: lines.map((l) => l.category_id),
          propertyIds: [...propNames.keys()],
          propertyNames: [...propNames.values()],
        };
      })}
    />
  );
}
