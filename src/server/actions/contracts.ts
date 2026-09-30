"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import {
  contractDraftSchema,
  noticeSchema,
  renewSchema,
  revisionSchema,
  terminateSchema,
  type ContractDraftInput,
} from "@/lib/schemas/contract";
import { loadParties, loadTemplate, renderWith, varsInput } from "@/server/queries/contracts";
import { ensureChargesUntil, MATERIALIZE_AHEAD } from "@/server/billing/ensure-charges";
import { uploadAttachment } from "./files";
import {
  addPeriods,
  contractEndDate,
  maxDate,
  periodEnd,
  periodOf,
  todayKuwait,
} from "@/domain/dates";
import {
  canPerform,
  earlyExitPenalty,
  expectedMoveOut,
  formatContractNo,
  renewalTerms,
  terminationSettlement,
  validateTerms,
} from "@/domain/contracts";
import { generateSchedule } from "@/domain/schedule";
import { allocateFIFO } from "@/domain/allocation";
import { arrearsAsOf } from "@/domain/ledger";
import { validateCivilId } from "@/domain/validation";
import type { RenderedContract } from "@/domain/templates";
import type { ContractStatus } from "@/domain/types";
import { formatDate } from "@/domain/dates";
import { notifyEvent } from "@/server/notify/events";
import type { SessionContext } from "@/lib/auth";

/** Tenant / property / unit labels for contract notifications. */
async function contractLabels(id: string) {
  const db = await supabaseServer();
  const { data } = await db
    .from("contracts")
    .select(
      "property_id, tenants(full_name), properties(name), contract_units(unit_id, units(label, sort_order))",
    )
    .eq("id", id)
    .single();
  const units = (
    (data?.contract_units ?? []) as unknown as {
      unit_id: string;
      units: { label: string; sort_order: number } | null;
    }[]
  ).sort((a, b) => (a.units?.sort_order ?? 0) - (b.units?.sort_order ?? 0));
  return {
    propertyId: data?.property_id ?? null,
    tenant: (data?.tenants as unknown as { full_name: string } | null)?.full_name ?? "",
    property: (data?.properties as unknown as { name: string } | null)?.name ?? "",
    unit: units.map((u) => u.units?.label ?? "").join(", "),
    units: units.map((u) => ({ id: u.unit_id, label: u.units?.label ?? "" })),
  };
}

async function notifyVacated(ctx: SessionContext, id: string, moveOut: string) {
  const l = await contractLabels(id);
  for (const u of l.units) {
    await notifyEvent(ctx, "unit_vacant", {
      url: `/units/${u.id}`,
      entityType: "unit",
      entityId: u.id,
      propertyId: l.propertyId,
      property: l.property,
      unit: u.label,
      dedupeKey: `vacant:${u.id}:${moveOut}`,
    }).catch(() => {});
  }
}

const reval = () => revalidatePath("/[locale]", "layout");
const until = () => addPeriods(periodOf(todayKuwait()), MATERIALIZE_AHEAD);

function rowFrom(orgId: string, d: ReturnType<typeof contractDraftSchema.parse>) {
  return {
    org_id: orgId,
    type: d.type,
    template_id: d.templateId ?? null,
    tenant_id: d.tenantId,
    property_id: d.propertyId,
    owner_id: d.ownerId ?? null,
    contract_date: d.contractDate,
    start_date: d.startDate,
    first_collection_date: d.firstCollectionDate,
    term_months: d.termMonths,
    end_date: contractEndDate(d.startDate, d.termMonths),
    auto_renew: d.autoRenew,
    renewal_term_months: d.renewalTermMonths ?? null,
    monthly_rent_fils: d.monthlyRentFils,
    purpose: d.purpose,
    utilities_party: d.utilitiesParty,
    electricity_fixed_fils: d.electricityFixedFils,
    free_months: d.freeMonths,
    free_months_penalty_window_months: d.freeMonthsPenaltyWindowMonths,
    notice_period_months: d.noticePeriodMonths,
    security_deposit_fils: d.securityDepositFils,
    deposit_status: d.securityDepositFils > 0 ? ("held" as const) : ("none" as const),
    annual_increase_kind: d.annualIncrease?.kind ?? null,
    annual_increase_value: d.annualIncrease?.value ?? null,
    annual_increase_every_months: d.annualIncrease?.everyMonths ?? null,
    clause_overrides: d.clauseOverrides,
    custom_clauses: d.customClauses,
    notes: d.notes,
  };
}

async function replaceUnits(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  orgId: string,
  contractId: string,
  unitIds: string[],
  shares?: number[] | null,
) {
  const del = await db.from("contract_units").delete().eq("contract_id", contractId);
  if (del.error) throw del.error;
  const ins = await db
    .from("contract_units")
    .insert(
      unitIds.map((u, i) => ({
        org_id: orgId,
        contract_id: contractId,
        unit_id: u,
        rent_share_fils: shares?.[i] ?? null,
      })),
    );
  if (ins.error) throw ins.error;
}

/** Creates or updates a draft (autosave from the wizard). */
export async function saveContractDraft(id: string | null, input: ContractDraftInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const d = contractDraftSchema.parse(input);
    const db = await supabaseServer();
    if (id) {
      const { data: cur } = await db.from("contracts").select("status").eq("id", id).single();
      if (cur?.status !== "draft") throw new ActionError("invalid_transition");
      const { error } = await db.from("contracts").update(rowFrom(ctx.orgId, d)).eq("id", id);
      if (error) throw error;
      await replaceUnits(db, ctx.orgId, id, d.unitIds, d.unitShares);
      reval();
      return id;
    }
    const { data, error } = await db
      .from("contracts")
      .insert({
        ...rowFrom(ctx.orgId, d),
        contract_no: `DRAFT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    await replaceUnits(db, ctx.orgId, data.id, d.unitIds, d.unitShares);
    reval();
    return data.id;
  });
}

export interface ContractPreview {
  rendered: RenderedContract;
  schedule: {
    period: string;
    kind: string;
    amountFils: number;
    waivedValueFils: number;
    dueDate: string;
  }[];
  warnings: string[];
  dayName: string;
}

/** Live preview for the wizard's clauses/review steps (rendered clauses, first charges, warnings). */
export async function previewContract(
  input: ContractDraftInput,
  excludeContractId?: string | null,
) {
  return run(async (): Promise<ContractPreview> => {
    await requireActionContext("manage_contracts");
    const d = contractDraftSchema.parse(input);
    const db = await supabaseServer();
    const [tpl, parties] = await Promise.all([
      loadTemplate(db, d.type, d.templateId),
      loadParties(db, d),
    ]);
    const endDate = contractEndDate(d.startDate, d.termMonths);
    const rendered = renderWith(
      tpl,
      varsInput(
        {
          contractNo: "—",
          type: d.type,
          contractDate: d.contractDate,
          startDate: d.startDate,
          firstCollectionDate: d.firstCollectionDate,
          endDate,
          termMonths: d.termMonths,
          autoRenew: d.autoRenew,
          monthlyRentFils: d.monthlyRentFils,
          purpose: d.purpose,
          utilitiesParty: d.utilitiesParty,
          electricityFixedFils: d.electricityFixedFils,
          freeMonths: d.freeMonths,
          noticePeriodMonths: d.noticePeriodMonths,
          securityDepositFils: d.securityDepositFils,
        },
        parties,
      ),
      d.clauseOverrides,
      d.customClauses,
    );
    const schedule = generateSchedule({
      startDate: d.startDate,
      endDate,
      firstCollectionDate: d.firstCollectionDate,
      monthlyRentFils: d.monthlyRentFils,
      electricityFixedFils: d.electricityFixedFils,
      annualIncrease: d.annualIncrease ?? null,
    }).slice(0, 8);
    const warnings: string[] = [...validateTerms(d)];
    if (parties.tenant.civilId && !validateCivilId(parties.tenant.civilId).checksumValid)
      warnings.push("tenant_civil_id_checksum");
    // Overlap with live contracts on the same units.
    const { data: live } = await db
      .from("contract_units")
      .select("contract_id, contracts!inner(start_date, end_date, move_out_date, status)")
      .in("unit_id", d.unitIds)
      .in("contracts.status", ["active", "notice_given"]);
    const overlaps = (live ?? []).filter((r) => {
      if (r.contract_id === excludeContractId) return false;
      const c = r.contracts as unknown as {
        start_date: string;
        end_date: string;
        move_out_date: string | null;
      };
      const end = c.move_out_date && c.move_out_date < c.end_date ? c.move_out_date : c.end_date;
      return c.start_date <= endDate && d.startDate <= end;
    });
    if (overlaps.length) warnings.push("overlap");
    const { dayNameAr } = await import("@/domain/dates");
    return { rendered, schedule, warnings, dayName: dayNameAr(d.contractDate) };
  });
}

async function renderFor(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  contractId: string,
  contractNo: string,
) {
  const { data: c, error } = await db
    .from("contracts")
    .select("*, contract_units(unit_id)")
    .eq("id", contractId)
    .single();
  if (error) throw error;
  const tpl = await loadTemplate(db, c.type, c.template_id);
  const parties = await loadParties(db, {
    ownerId: c.owner_id,
    tenantId: c.tenant_id,
    propertyId: c.property_id,
    unitIds: (c.contract_units ?? []).map((u) => u.unit_id),
  });
  const rendered = renderWith(
    tpl,
    varsInput(
      {
        contractNo,
        type: c.type,
        contractDate: c.contract_date,
        startDate: c.start_date,
        firstCollectionDate: c.first_collection_date,
        endDate: c.end_date,
        termMonths: c.term_months,
        autoRenew: c.auto_renew,
        monthlyRentFils: c.monthly_rent_fils,
        purpose: c.purpose,
        utilitiesParty: c.utilities_party,
        electricityFixedFils: c.electricity_fixed_fils,
        freeMonths: c.free_months,
        noticePeriodMonths: c.notice_period_months,
        securityDepositFils: c.security_deposit_fils,
      },
      parties,
    ),
    (c.clause_overrides ?? {}) as {
      enabled?: Record<string, boolean>;
      text?: Record<string, string>;
    },
    (c.custom_clauses ?? []) as { key: string; text: string }[],
  );
  return { contract: c, rendered, templateId: tpl.id, templateVersion: tpl.version };
}

/** Activates a draft: allocates the gapless number, freezes the rendered clauses and generates charges. */
export async function activateContract(id: string) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const db = await supabaseServer();
    const { data: c } = await db
      .from("contracts")
      .select("status, type, contract_date, contract_no")
      .eq("id", id)
      .single();
    if (!c || !canPerform(c.status as ContractStatus, "activate"))
      throw new ActionError("invalid_transition");
    const year = Number(c.contract_date.slice(0, 4));
    const key = c.type === "residential" ? "contract_residential" : "contract_investment";
    const { data: seq, error: seqErr } = await db.rpc("next_number", {
      p_org: ctx.orgId,
      p_key: key,
      p_year: year,
    });
    if (seqErr) throw seqErr;
    const prefix =
      c.type === "residential"
        ? ctx.settings.numbering.contractResidential
        : ctx.settings.numbering.contractInvestment;
    const contractNo = formatContractNo(c.type, year, seq as number).replace(/^[RI]/, prefix);
    const { rendered, templateId, templateVersion } = await renderFor(db, id, contractNo);
    const { error } = await db
      .from("contracts")
      .update({
        status: "active",
        contract_no: contractNo,
        template_id: templateId,
        rendered_clauses: { ...rendered, templateVersion } as never,
        activated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    await ensureChargesUntil(ctx.orgId, until(), ctx.settings, [id]);
    reval();
    return contractNo;
  });
}

export async function recordNotice(
  id: string,
  input: { noticeDate: string; expectedMoveOut?: string | null },
) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const d = noticeSchema.parse(input);
    const db = await supabaseServer();
    const { data: c } = await db
      .from("contracts")
      .select("status, notice_period_months")
      .eq("id", id)
      .single();
    if (!c || !canPerform(c.status as ContractStatus, "record_notice"))
      throw new ActionError("invalid_transition");
    const { error } = await db
      .from("contracts")
      .update({
        status: "notice_given",
        notice_date: d.noticeDate,
        expected_move_out:
          d.expectedMoveOut ?? expectedMoveOut(d.noticeDate, c.notice_period_months),
      })
      .eq("id", id);
    if (error) throw error;
    const l = await contractLabels(id);
    await notifyEvent(ctx, "notice_recorded", {
      url: `/contracts/${id}`,
      contractId: id,
      entityType: "contract",
      entityId: id,
      propertyId: l.propertyId,
      tenant: l.tenant,
      property: l.property,
      unit: l.unit,
      date: formatDate(d.expectedMoveOut ?? expectedMoveOut(d.noticeDate, c.notice_period_months)),
      dedupeKey: `notice:${id}:${d.noticeDate}`,
    }).catch(() => {});
    reval();
  });
}

/** Rent revision from a date: updates unpaid materialized rent charges from that period on. */
export async function reviseRent(
  id: string,
  input: { effectiveFrom: string; monthlyRentFils: number; reason?: string | null },
) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const d = revisionSchema.parse(input);
    const db = await supabaseServer();
    const { data: c } = await db.from("contracts").select("status").eq("id", id).single();
    if (!c || !canPerform(c.status as ContractStatus, "revise_rent"))
      throw new ActionError("invalid_transition");
    const ins = await db
      .from("contract_rent_revisions")
      .insert({
        org_id: ctx.orgId,
        contract_id: id,
        effective_from: d.effectiveFrom,
        monthly_rent_fils: d.monthlyRentFils,
        reason: d.reason,
      });
    if (ins.error) throw ins.error;
    const { data: charges } = await db
      .from("v_charge_balances")
      .select("charge_id, period, kind, allocated_fils")
      .eq("contract_id", id)
      .eq("kind", "rent")
      .gte("period", periodOf(d.effectiveFrom));
    for (const ch of charges ?? []) {
      if ((ch.allocated_fils ?? 0) > d.monthlyRentFils) continue;
      const u = await db
        .from("charges")
        .update({ amount_fils: d.monthlyRentFils })
        .eq("id", ch.charge_id!);
      if (u.error && u.error.hint !== "period_closed") throw u.error;
    }
    const free = await db
      .from("charges")
      .select("id")
      .eq("contract_id", id)
      .eq("kind", "free")
      .gte("period", periodOf(d.effectiveFrom));
    for (const f of free.data ?? [])
      await db.from("charges").update({ waived_value_fils: d.monthlyRentFils }).eq("id", f.id);
    reval();
  });
}

/** Renew: new linked contract starting the day after the old end; old → renewed. */
export async function renewContract(
  id: string,
  input: { termMonths: number; monthlyRentFils: number; activate?: boolean },
) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const d = renewSchema.parse(input);
    const db = await supabaseServer();
    const { data: c } = await db
      .from("contracts")
      .select("*, contract_units(unit_id, rent_share_fils)")
      .eq("id", id)
      .single();
    if (!c || !canPerform(c.status as ContractStatus, "renew"))
      throw new ActionError("invalid_transition");
    const terms = renewalTerms({
      endDate: c.end_date,
      termMonths: c.term_months,
      renewalTermMonths: d.termMonths,
      monthlyRentFils: c.monthly_rent_fils,
      newRentFils: d.monthlyRentFils,
    });
    const { data: created, error } = await db
      .from("contracts")
      .insert({
        org_id: ctx.orgId,
        contract_no: `DRAFT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        type: c.type,
        template_id: c.template_id,
        tenant_id: c.tenant_id,
        property_id: c.property_id,
        owner_id: c.owner_id,
        contract_date: todayKuwait(),
        start_date: terms.startDate,
        first_collection_date: terms.firstCollectionDate,
        term_months: terms.termMonths,
        end_date: terms.endDate,
        auto_renew: c.auto_renew,
        renewal_term_months: c.renewal_term_months,
        monthly_rent_fils: terms.monthlyRentFils,
        purpose: c.purpose,
        utilities_party: c.utilities_party,
        electricity_fixed_fils: c.electricity_fixed_fils,
        free_months: 0,
        free_months_penalty_window_months: c.free_months_penalty_window_months,
        notice_period_months: c.notice_period_months,
        security_deposit_fils: c.security_deposit_fils,
        deposit_status: c.deposit_status,
        clause_overrides: c.clause_overrides,
        custom_clauses: c.custom_clauses,
        renewed_from_id: c.id,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    await replaceUnits(
      db,
      ctx.orgId,
      created.id,
      (c.contract_units ?? []).map((u) => u.unit_id),
      (c.contract_units ?? []).every((u) => u.rent_share_fils !== null)
        ? (c.contract_units ?? []).map((u) => u.rent_share_fils!)
        : null,
    );
    const upd = await db.from("contracts").update({ status: "renewed" }).eq("id", id);
    if (upd.error) throw upd.error;
    if (d.activate) {
      const r = await activateContract(created.id);
      if (!r.ok) {
        await db.from("contracts").update({ status: c.status }).eq("id", id);
        throw new ActionError(r.error);
      }
    }
    reval();
    return created.id;
  });
}

export interface TerminationQuote {
  arrearsFils: number;
  penaltyFils: number;
  depositFils: number;
  depositAppliedFils: number;
  refundFils: number;
  remainingDueFils: number;
}

/** Computes the termination settlement for a move-out date (shown before confirming). */
export async function quoteTermination(id: string, moveOutDate: string, penaltyOverride?: number) {
  return run(async (): Promise<TerminationQuote> => {
    await requireActionContext("manage_contracts");
    const db = await supabaseServer();
    const { data: c } = await db
      .from("contracts")
      .select(
        "type, start_date, free_months, free_months_penalty_window_months, monthly_rent_fils, security_deposit_fils",
      )
      .eq("id", id)
      .single();
    if (!c) throw new ActionError("notFound");
    const [{ data: charges }, { data: payments }, { data: allocs }] = await Promise.all([
      db
        .from("charges")
        .select("id, contract_id, period, kind, amount_fils, waived_value_fils, due_date, voided")
        .eq("contract_id", id)
        .eq("voided", false),
      db
        .from("payments")
        .select("id, contract_id, amount_fils, received_at, voided")
        .eq("contract_id", id)
        .eq("voided", false),
      db
        .from("payment_allocations")
        .select("payment_id, charge_id, amount_fils, payments!inner(contract_id)")
        .eq("payments.contract_id", id),
    ]);
    const lastPeriod = periodOf(moveOutDate);
    const ledger = {
      charges: (charges ?? [])
        .filter((ch) => ch.period <= lastPeriod)
        .map((ch) => ({
          id: ch.id,
          contractId: id,
          period: ch.period,
          kind: ch.kind,
          amountFils: ch.amount_fils,
          waivedValueFils: ch.waived_value_fils,
          dueDate: ch.due_date,
        })),
      payments: (payments ?? []).map((p) => ({
        id: p.id,
        contractId: id,
        amountFils: p.amount_fils,
        receivedAt: p.received_at,
      })),
      allocations: (allocs ?? []).map((a) => ({
        paymentId: a.payment_id,
        chargeId: a.charge_id,
        amountFils: a.amount_fils,
      })),
    };
    const arrears = arrearsAsOf(ledger, maxDate(todayKuwait(), periodEnd(lastPeriod)));
    const penalty =
      penaltyOverride ??
      earlyExitPenalty(
        {
          type: c.type,
          startDate: c.start_date,
          freeMonths: c.free_months,
          freeMonthsPenaltyWindowMonths: c.free_months_penalty_window_months,
          monthlyRentFils: c.monthly_rent_fils,
        },
        moveOutDate,
      );
    const s = terminationSettlement({
      arrearsFils: arrears,
      penaltyFils: penalty,
      securityDepositFils: c.security_deposit_fils,
    });
    return {
      arrearsFils: arrears,
      penaltyFils: penalty,
      depositFils: c.security_deposit_fils,
      depositAppliedFils: s.depositAppliedFils,
      refundFils: s.refundFils,
      remainingDueFils: s.remainingDueFils,
    };
  });
}

/**
 * Terminate: sets move-out, voids charges after the move-out month (releasing
 * any advance allocations into credit), adds the early-exit penalty charge,
 * and applies the security deposit against what is owed.
 */
export async function terminateContract(
  id: string,
  input: { moveOutDate: string; reason: string; penaltyFils: number },
) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const d = terminateSchema.parse(input);
    const db = await supabaseServer();
    const admin = supabaseAdmin();
    const { data: c } = await db
      .from("contracts")
      .select("status, tenant_id, security_deposit_fils")
      .eq("id", id)
      .single();
    if (!c || !canPerform(c.status as ContractStatus, "terminate"))
      throw new ActionError("invalid_transition");
    const lastPeriod = periodOf(d.moveOutDate);
    const { data: future } = await db
      .from("charges")
      .select("id")
      .eq("contract_id", id)
      .eq("voided", false)
      .gt("period", lastPeriod);
    const futureIds = (future ?? []).map((f) => f.id);
    if (futureIds.length) {
      const rel = await admin.from("payment_allocations").delete().in("charge_id", futureIds);
      if (rel.error) throw rel.error;
      const v = await db
        .from("charges")
        .update({ voided: true, void_reason: `terminated ${d.moveOutDate}` })
        .in("id", futureIds);
      if (v.error) throw v.error;
    }
    const upd = await db
      .from("contracts")
      .update({ status: "terminated", move_out_date: d.moveOutDate, termination_reason: d.reason })
      .eq("id", id);
    if (upd.error) throw upd.error;
    if (d.penaltyFils > 0) {
      const p = await db
        .from("charges")
        .insert({
          org_id: ctx.orgId,
          contract_id: id,
          period: lastPeriod,
          kind: "penalty",
          amount_fils: d.penaltyFils,
          due_date: d.moveOutDate,
          description: "غرامة الإخلاء المبكر (قيمة الأشهر المجانية)",
        });
      if (p.error) throw p.error;
    }
    // Released advances become credit → consume against remaining charges.
    const { applyCredit } = await import("@/server/billing/ensure-charges");
    await applyCredit(ctx.orgId, [id]);
    // Apply the security deposit to what is still owed.
    const q = await quoteTermination(id, d.moveOutDate, d.penaltyFils);
    if (!q.ok) throw new ActionError(q.error);
    // The penalty is now a charge, so the quote's arrears already include it (quote penalty is informational).
    const settle = terminationSettlement({
      arrearsFils: q.data.arrearsFils,
      penaltyFils: 0,
      securityDepositFils: c.security_deposit_fils,
    });
    if (settle.depositAppliedFils > 0) {
      const { data: pay, error: pe } = await db
        .from("payments")
        .insert({
          org_id: ctx.orgId,
          tenant_id: c.tenant_id,
          contract_id: id,
          amount_fils: settle.depositAppliedFils,
          method: "cash",
          received_at: d.moveOutDate,
          notes: "تسوية مبلغ التأمين عند الإخلاء",
          collected_by: ctx.userId,
        })
        .select("id")
        .single();
      if (pe) throw pe;
      const { data: open } = await db
        .from("v_charge_balances")
        .select("charge_id, period, kind, due_date, outstanding_fils")
        .eq("contract_id", id)
        .gt("outstanding_fils", 0);
      const r = allocateFIFO(
        settle.depositAppliedFils,
        (open ?? []).map((o) => ({
          id: o.charge_id!,
          period: o.period!,
          kind: o.kind!,
          dueDate: o.due_date!,
          outstandingFils: o.outstanding_fils!,
        })),
      );
      if (r.allocations.length)
        await db
          .from("payment_allocations")
          .insert(
            r.allocations.map((a) => ({
              org_id: ctx.orgId,
              payment_id: pay.id,
              charge_id: a.chargeId,
              amount_fils: a.amountFils,
            })),
          );
    }
    if (c.security_deposit_fils > 0)
      await db.from("contracts").update({ deposit_status: settle.depositStatus }).eq("id", id);
    await notifyVacated(ctx, id, d.moveOutDate);
    reval();
    return {
      ...q.data,
      depositAppliedFils: settle.depositAppliedFils,
      refundFils: settle.refundFils,
    };
  });
}

/** Marks a naturally finished contract as ended. */
export async function endContract(id: string) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const db = await supabaseServer();
    const { data: c } = await db.from("contracts").select("status").eq("id", id).single();
    if (!c || !canPerform(c.status as ContractStatus, "end"))
      throw new ActionError("invalid_transition");
    const { error } = await db.from("contracts").update({ status: "ended" }).eq("id", id);
    if (error) throw error;
    await notifyVacated(ctx, id, todayKuwait());
    reval();
  });
}

export async function duplicateContract(id: string) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const db = await supabaseServer();
    const { data: c } = await db
      .from("contracts")
      .select("*, contract_units(unit_id)")
      .eq("id", id)
      .single();
    if (!c) throw new ActionError("notFound");
    const { data, error } = await db
      .from("contracts")
      .insert({
        org_id: ctx.orgId,
        contract_no: `DRAFT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        type: c.type,
        template_id: null,
        tenant_id: c.tenant_id,
        property_id: c.property_id,
        owner_id: c.owner_id,
        contract_date: todayKuwait(),
        start_date: todayKuwait(),
        first_collection_date: todayKuwait(),
        term_months: c.term_months,
        end_date: contractEndDate(todayKuwait(), c.term_months),
        auto_renew: c.auto_renew,
        monthly_rent_fils: c.monthly_rent_fils,
        purpose: c.purpose,
        utilities_party: c.utilities_party,
        electricity_fixed_fils: c.electricity_fixed_fils,
        free_months: c.free_months,
        notice_period_months: c.notice_period_months,
        security_deposit_fils: c.security_deposit_fils,
        clause_overrides: c.clause_overrides,
        custom_clauses: c.custom_clauses,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    reval();
    return data.id;
  });
}

export async function deleteDraft(id: string) {
  return run(async () => {
    await requireActionContext("manage_contracts");
    const db = await supabaseServer();
    const { data: c } = await db.from("contracts").select("status").eq("id", id).single();
    if (c?.status !== "draft") throw new ActionError("invalid_transition");
    const { error } = await db.from("contracts").delete().eq("id", id);
    if (error) throw error;
    reval();
  });
}

export async function uploadSignedContract(id: string, form: FormData) {
  return run(async () => {
    await requireActionContext("manage_contracts");
    const r = await uploadAttachment("contract", id, form, "contracts");
    if (!r.ok) throw new ActionError(r.error);
    const db = await supabaseServer();
    const { error } = await db
      .from("contracts")
      .update({ signed_file_path: r.data.path })
      .eq("id", id);
    if (error) throw error;
    reval();
  });
}
