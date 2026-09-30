import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAll } from "@/server/db";
import { can } from "@/lib/permissions";
import { PaymentsView } from "./payments-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "payments" });
  return { title: t("title") };
}

export default async function PaymentsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const [rows, { data: members }] = await Promise.all([
    fetchAll((f, t) =>
      db
        .from("payments")
        .select(
          "id, received_at, receipt_no, system_no, amount_fils, method, voided, collected_by, tenants(full_name), contracts(contract_units(units(label)), properties(name))",
        )
        .order("received_at", { ascending: false })
        .order("created_at", { ascending: false })
        .range(f, t),
    ),
    db.from("org_members").select("user_id, display_name"),
  ]);
  const names = new Map((members ?? []).map((m) => [m.user_id, m.display_name ?? ""]));
  return (
    <PaymentsView
      collectorOnly={ctx.role === "collector"}
      userId={ctx.userId}
      canExport={can(ctx.role, "view_reports")}
      rows={rows.map((p) => {
        const c = p.contracts as unknown as {
          contract_units: { units: { label: string } }[];
          properties: { name: string };
        };
        return {
          id: p.id,
          date: p.received_at,
          receiptNo: p.receipt_no,
          systemNo: p.system_no,
          amountFils: p.amount_fils,
          method: p.method,
          voided: p.voided,
          collectorId: p.collected_by,
          collector: p.collected_by ? (names.get(p.collected_by) ?? "") : "",
          tenant: (p.tenants as unknown as { full_name: string }).full_name,
          unit: `${c.properties.name} · ${c.contract_units.map((u) => u.units.label).join(", ")}`,
        };
      })}
    />
  );
}
