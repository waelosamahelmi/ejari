import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { LegalView } from "./legal-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "legal" });
  return { title: t("title") };
}

export default async function LegalPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_legal" });
  const db = await supabaseServer();
  const [{ data: cases }, { data: tenants }, { data: contracts }] = await Promise.all([
    db.from("legal_cases").select("id, case_no, court, type, status, amount_claimed_fils, next_hearing_date, lawyer, tenant_id, contract_id, tenants(full_name), contracts(contract_no, properties(name))").order("next_hearing_date", { ascending: true, nullsFirst: false }),
    db.from("tenants").select("id, full_name").order("full_name"),
    db.from("contracts").select("id, tenant_id, contract_no, properties(name)").neq("status", "draft"),
  ]);
  return (
    <LegalView
      canManage={can(ctx.role, "manage_legal")}
      cases={(cases ?? []).map((c) => ({
        id: c.id,
        caseNo: c.case_no,
        court: c.court,
        type: c.type,
        status: c.status,
        amountFils: c.amount_claimed_fils,
        nextHearing: c.next_hearing_date,
        tenant: (c.tenants as unknown as { full_name: string }).full_name,
        contract: c.contracts ? `${(c.contracts as unknown as { contract_no: string }).contract_no} · ${(c.contracts as unknown as { properties: { name: string } }).properties.name}` : null,
      }))}
      tenants={(tenants ?? []).map((x) => ({ id: x.id, name: x.full_name }))}
      contracts={(contracts ?? []).map((x) => ({ id: x.id, tenantId: x.tenant_id, label: `${x.contract_no} · ${(x.properties as unknown as { name: string }).name}` }))}
    />
  );
}
