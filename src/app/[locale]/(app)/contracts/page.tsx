import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAll } from "@/server/db";
import { can } from "@/lib/permissions";
import { todayKuwait } from "@/domain/dates";
import { ContractsView } from "./contracts-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "contracts" });
  return { title: t("title") };
}

export default async function ContractsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const rows = await fetchAll((f, t) =>
    db
      .from("contracts")
      .select("id, contract_no, type, status, start_date, end_date, move_out_date, monthly_rent_fils, auto_renew, tenants(full_name), properties(id, name), contract_units(units(label, sort_order))")
      .order("created_at", { ascending: false })
      .range(f, t),
  );
  return (
    <ContractsView
      today={todayKuwait()}
      canCreate={can(ctx.role, "manage_contracts")}
      rows={rows.map((c) => ({
        id: c.id,
        contractNo: c.contract_no,
        type: c.type,
        status: c.status,
        startDate: c.start_date,
        endDate: c.move_out_date ?? c.end_date,
        rentFils: c.monthly_rent_fils,
        autoRenew: c.auto_renew,
        tenant: (c.tenants as unknown as { full_name: string } | null)?.full_name ?? "",
        propertyId: (c.properties as unknown as { id: string }).id,
        property: (c.properties as unknown as { name: string }).name,
        units: (c.contract_units ?? [])
          .map((u) => u.units as unknown as { label: string; sort_order: number })
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((u) => u.label)
          .join(", "),
      }))}
    />
  );
}
