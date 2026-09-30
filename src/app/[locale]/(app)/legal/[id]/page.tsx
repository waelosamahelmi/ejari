import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { CaseView } from "./case-view";

export default async function CasePage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_legal" });
  const db = await supabaseServer();
  const [{ data: c }, { data: tenants }, { data: contracts }] = await Promise.all([
    db
      .from("legal_cases")
      .select(
        "*, tenants(full_name), contracts(contract_no), legal_case_events(id, event_date, title, notes)",
      )
      .eq("id", id)
      .maybeSingle(),
    db.from("tenants").select("id, full_name").order("full_name"),
    db
      .from("contracts")
      .select("id, tenant_id, contract_no, properties(name)")
      .neq("status", "draft"),
  ]);
  if (!c) notFound();
  return (
    <CaseView
      canManage={can(ctx.role, "manage_legal")}
      tenants={(tenants ?? []).map((x) => ({ id: x.id, name: x.full_name }))}
      contracts={(contracts ?? []).map((x) => ({
        id: x.id,
        tenantId: x.tenant_id,
        label: `${x.contract_no} · ${(x.properties as unknown as { name: string }).name}`,
      }))}
      value={{
        id: c.id,
        tenantId: c.tenant_id,
        contractId: c.contract_id,
        caseNo: c.case_no,
        court: c.court,
        type: c.type,
        status: c.status,
        amountClaimedFils: c.amount_claimed_fils,
        nextHearingDate: c.next_hearing_date,
        lawyer: c.lawyer,
        notes: c.notes,
      }}
      tenant={(c.tenants as unknown as { full_name: string }).full_name}
      contractNo={(c.contracts as unknown as { contract_no: string } | null)?.contract_no ?? null}
      events={(c.legal_case_events ?? []).sort((a, b) => b.event_date.localeCompare(a.event_date))}
    />
  );
}
