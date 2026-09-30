import { notFound, redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { signPath } from "@/server/storage";
import { todayKuwait, periodEnd } from "@/domain/dates";
import { balanceSummary, chargeStates, periodStatus } from "@/domain/ledger";
import { earlyExitPenalty } from "@/domain/contracts";
import { can } from "@/lib/permissions";
import { ContractDetailView } from "./contract-detail-view";
import { RecordPaymentButton } from "@/components/domain/payments/record-payment-button";

export async function generateMetadata({ params }: LocaleParams<{ id: string }>) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data } = await db.from("contracts").select("contract_no").eq("id", id).maybeSingle();
  return { title: data?.contract_no ?? "" };
}

export default async function ContractPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const { data: c } = await db
    .from("contracts")
    .select("*, tenants(id, full_name, phones), properties(id, name), contract_units(units(id, label, sort_order)), contract_rent_revisions(effective_from, monthly_rent_fils, reason, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  if (c.status === "draft") redirect(`/${locale}/contracts/new?draft=${id}`);
  const [{ data: renewedTo }, { data: renewedFrom }] = await Promise.all([
    db.from("contracts").select("id, contract_no").eq("renewed_from_id", id).maybeSingle(),
    c.renewed_from_id ? db.from("contracts").select("id, contract_no").eq("id", c.renewed_from_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const ledger = data.idx.ledger(id);
  const states = chargeStates(ledger, today);
  const periods = [...new Set(ledger.charges.map((ch) => ch.period))].sort();
  const schedule = periods.map((p) => {
    const chs = ledger.charges.filter((ch) => ch.period === p);
    const asOf = periodEnd(p) < today ? periodEnd(p) : today;
    return {
      period: p,
      dueDate: chs.reduce((d, ch) => (ch.dueDate < d ? ch.dueDate : d), chs[0]!.dueDate),
      kinds: chs.map((ch) => ch.kind),
      amountFils: chs.reduce((a, ch) => a + ch.amountFils, 0),
      waivedFils: chs.reduce((a, ch) => a + ch.waivedValueFils, 0),
      paidFils: chs.reduce((a, ch) => a + (states.get(ch.id)?.allocatedFils ?? 0), 0),
      status: periodStatus(ledger, p, asOf, { legal: data.idx.legalStatus(id) !== "none" }),
    };
  });
  const bal = balanceSummary(ledger, today);
  const units = (c.contract_units ?? []).map((u) => u.units as unknown as { id: string; label: string; sort_order: number }).sort((a, b) => a.sort_order - b.sort_order);
  const tenant = c.tenants as unknown as { id: string; full_name: string; phones: string[] };
  const property = c.properties as unknown as { id: string; name: string };
  const payments = ledger.payments.map((p) => ({ date: p.receivedAt, amountFils: p.amountFils, receiptNo: p.receiptNo ?? null }));
  return (
    <ContractDetailView
      today={today}
      contract={{
        id: c.id,
        contractNo: c.contract_no,
        type: c.type,
        status: c.status,
        tenantId: tenant.id,
        tenantName: tenant.full_name,
        tenantPhone: tenant.phones?.[0] ?? null,
        propertyId: property.id,
        propertyName: property.name,
        units,
        contractDate: c.contract_date,
        startDate: c.start_date,
        firstCollectionDate: c.first_collection_date,
        endDate: c.end_date,
        termMonths: c.term_months,
        autoRenew: c.auto_renew,
        renewalTermMonths: c.renewal_term_months,
        monthlyRentFils: c.monthly_rent_fils,
        freeMonths: c.free_months,
        noticePeriodMonths: c.notice_period_months,
        securityDepositFils: c.security_deposit_fils,
        depositStatus: c.deposit_status,
        noticeDate: c.notice_date,
        expectedMoveOut: c.expected_move_out,
        moveOutDate: c.move_out_date,
        terminationReason: c.termination_reason,
        createdAt: c.created_at,
        activatedAt: c.activated_at,
        signedUrl: c.signed_file_path ? await signPath("contracts", c.signed_file_path) : null,
        revisions: (c.contract_rent_revisions ?? []).map((r) => ({ effectiveFrom: r.effective_from, monthlyRentFils: r.monthly_rent_fils, reason: r.reason, createdAt: r.created_at })),
        renewedTo: renewedTo ?? null,
        renewedFrom: renewedFrom ?? null,
        suggestedPenaltyToday: earlyExitPenalty({ type: c.type, startDate: c.start_date, freeMonths: c.free_months, freeMonthsPenaltyWindowMonths: c.free_months_penalty_window_months, monthlyRentFils: c.monthly_rent_fils }, today),
      }}
      schedule={schedule}
      balance={{ arrearsFils: bal.arrearsFils, creditFils: bal.creditFils, paidFils: bal.paidFils, chargedFils: bal.chargedFils }}
      payments={payments}
      canManage={can(ctx.role, "manage_contracts")}
      canPay={can(ctx.role, "record_payment")}
      paymentAction={can(ctx.role, "record_payment") && (c.status === "active" || c.status === "notice_given" || bal.arrearsFils > 0) ? <RecordPaymentButton contractId={c.id} size="md" /> : undefined}
    />
  );
}
