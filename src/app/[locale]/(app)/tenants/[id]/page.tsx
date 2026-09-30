import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { todayKuwait } from "@/domain/dates";
import { balanceSummary, buildLedger } from "@/domain/ledger";
import { maskCivilId, validateCivilId } from "@/domain/validation";
import { can } from "@/lib/permissions";
import { TenantDetailView } from "./tenant-detail-view";
import {
  RecordPaymentButton,
  RemindButton,
} from "@/components/domain/payments/record-payment-button";

export async function generateMetadata({ params }: LocaleParams<{ id: string }>) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data } = await db.from("tenants").select("full_name").eq("id", id).maybeSingle();
  return { title: data?.full_name ?? "" };
}

export default async function TenantPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const [{ data: tenant }, { data: reminders }, { data: legal }] = await Promise.all([
    db.from("tenants").select("*").eq("id", id).maybeSingle(),
    db
      .from("reminders_log")
      .select("id, channel, message, sent_at")
      .eq("tenant_id", id)
      .order("sent_at", { ascending: false })
      .limit(50),
    db
      .from("legal_cases")
      .select("id, case_no, court, type, status, next_hearing_date, amount_claimed_fils")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!tenant) notFound();
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const contracts = data.ds.contracts
    .filter((c) => c.tenantId === id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const ledgerRows = contracts.flatMap((c) => {
    const l = data.idx.ledger(c.id);
    return buildLedger(l, { until: today }).map((r) => ({ ...r, contractNo: c.contractNo }));
  });
  ledgerRows.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  const ledger = ledgerRows.map((r) => ({
    ...r,
    balanceFils: (bal += r.debitFils - r.creditFils),
  }));
  const totals = contracts.reduce(
    (acc, c) => {
      const b = balanceSummary(data.idx.ledger(c.id), today);
      return { arrears: acc.arrears + b.arrearsFils, credit: acc.credit + b.creditFils };
    },
    { arrears: 0, credit: 0 },
  );
  const fullId = can(ctx.role, "manage_contracts");
  const live = contracts.find((c) => c.status === "active" || c.status === "notice_given");
  const lateContract = contracts.find(
    (c) => balanceSummary(data.idx.ledger(c.id), today).arrearsFils > 0,
  );
  return (
    <TenantDetailView
      tenant={{
        id: tenant.id,
        fullName: tenant.full_name,
        civilIdDisplay: fullId ? (tenant.civil_id ?? "") : maskCivilId(tenant.civil_id),
        civilIdRaw: fullId ? (tenant.civil_id ?? "") : "",
        civilIdChecksumOk: tenant.civil_id ? validateCivilId(tenant.civil_id).checksumValid : true,
        nationality: tenant.nationality,
        phones: tenant.phones ?? [],
        email: tenant.email,
        employer: tenant.employer,
        emergencyContact: tenant.emergency_contact,
        notes: tenant.notes,
        blacklisted: tenant.blacklisted,
        blacklistReason: tenant.blacklist_reason,
      }}
      contracts={contracts.map((c) => ({
        id: c.id,
        contractNo: c.contractNo,
        status: c.status,
        propertyName: data.properties.get(c.propertyId)?.name ?? "",
        units: c.unitIds.map((u) => data.units.get(u)?.label ?? "").join(", "),
        rentFils: c.monthlyRentFils,
        startDate: c.startDate,
        endDate: c.moveOutDate ?? c.endDate,
      }))}
      ledger={ledger}
      totals={totals}
      reminders={reminders ?? []}
      legal={legal ?? []}
      canEdit={can(ctx.role, "manage_master_data")}
      reminderAction={
        <div className="grid gap-2">
          {live && can(ctx.role, "record_payment") && (
            <RecordPaymentButton contractId={live.id} size="md" className="w-full" />
          )}
          {lateContract && can(ctx.role, "send_reminder") && (
            <RemindButton contractId={lateContract.id} />
          )}
        </div>
      }
    />
  );
}
