"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import { allocateFIFO, allocateManual, allocateToPeriods, type OpenCharge } from "@/domain/allocation";
import { formatSequenceNo } from "@/domain/contracts";
import { fromFils } from "@/domain/money";
import { formatPeriod, periodOf, todayKuwait } from "@/domain/dates";
import { isoDate } from "@/lib/schemas/common";
import { PAYMENT_METHODS } from "@/domain/types";
import { notifyEvent } from "@/server/notify/events";

const reval = () => revalidatePath("/[locale]", "layout");

export interface PaymentContext {
  contractId: string;
  contractNo: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  propertyName: string;
  unitLabels: string;
  monthlyRentFils: number;
  open: OpenCharge[];
  /** Due now (outstanding of charges due ≤ today). */
  dueNowFils: number;
  /** This month's outstanding. */
  thisMonthFils: number;
  creditFils: number;
  collectors: { id: string; name: string }[];
}

/** Everything the Record-payment sheet needs for one contract. */
export async function getPaymentContext(contractId: string) {
  return run(async (): Promise<PaymentContext> => {
    const ctx = await requireActionContext("record_payment");
    const db = await supabaseServer();
    const [{ data: c }, { data: balances }, { data: pays }, { data: members }] = await Promise.all([
      db.from("contracts").select("id, contract_no, tenant_id, monthly_rent_fils, status, tenants(full_name, phones), properties(name), contract_units(units(label, sort_order))").eq("id", contractId).single(),
      db.from("v_charge_balances").select("charge_id, period, kind, due_date, outstanding_fils").eq("contract_id", contractId).gt("outstanding_fils", 0),
      db.from("payments").select("amount_fils, payment_allocations(amount_fils)").eq("contract_id", contractId).eq("voided", false),
      db.from("org_members").select("user_id, display_name, role").eq("active", true).in("role", ["admin", "accountant", "collector"]),
    ]);
    if (!c) throw new ActionError("notFound");
    const today = todayKuwait();
    const open = (balances ?? []).map((b) => ({ id: b.charge_id!, period: b.period!, kind: b.kind!, dueDate: b.due_date!, outstandingFils: b.outstanding_fils! }));
    const credit = (pays ?? []).reduce((s, p) => s + p.amount_fils - (p.payment_allocations ?? []).reduce((a, x) => a + x.amount_fils, 0), 0);
    const units = (c.contract_units ?? []).map((u) => u.units as unknown as { label: string; sort_order: number }).sort((a, b) => a.sort_order - b.sort_order);
    const t = c.tenants as unknown as { full_name: string; phones: string[] };
    return {
      contractId: c.id,
      contractNo: c.contract_no,
      tenantId: c.tenant_id,
      tenantName: t.full_name,
      tenantPhone: t.phones?.[0] ?? null,
      propertyName: (c.properties as unknown as { name: string }).name,
      unitLabels: units.map((u) => u.label).join(", "),
      monthlyRentFils: c.monthly_rent_fils,
      open,
      dueNowFils: open.filter((o) => o.dueDate <= today).reduce((a, o) => a + o.outstandingFils, 0),
      thisMonthFils: open.filter((o) => o.period === periodOf(today)).reduce((a, o) => a + o.outstandingFils, 0),
      creditFils: Math.max(0, credit),
      collectors: (members ?? []).map((m) => ({ id: m.user_id, name: m.display_name ?? "" })),
    };
    void ctx;
  });
}

/** Duplicate receipt numbers produce a warning (org policy may block). */
export async function checkReceiptNo(receiptNo: string, excludeId?: string) {
  await requireActionContext();
  const db = await supabaseServer();
  let q = db.from("payments").select("id, received_at, amount_fils, tenants(full_name)").eq("receipt_no", receiptNo.trim()).eq("voided", false);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(1).maybeSingle();
  return data ? { id: data.id, date: data.received_at, amountFils: data.amount_fils, tenant: (data.tenants as unknown as { full_name: string } | null)?.full_name ?? "" } : null;
}

const paymentSchema = z.object({
  contractId: z.string().uuid(),
  amountFils: z.number().int().positive("positive"),
  method: z.enum(PAYMENT_METHODS),
  receivedAt: isoDate,
  receiptNo: z.string().trim().max(40).optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  collectedBy: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  allocation: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("fifo") }),
    z.object({ mode: z.literal("periods"), periods: z.array(z.string()).min(1) }),
    z.object({ mode: z.literal("manual"), lines: z.array(z.object({ chargeId: z.string().uuid(), amountFils: z.number().int().nonnegative() })) }),
  ]),
});
export type RecordPaymentInput = z.input<typeof paymentSchema>;

/**
 * Records a payment and its allocations (FIFO by default; chosen periods or
 * manual lines on override). Idempotent on client_id (offline sync).
 */
export async function recordPayment(input: RecordPaymentInput) {
  return run(async () => {
    const ctx = await requireActionContext("record_payment");
    const d = paymentSchema.parse(input);
    const db = await supabaseServer();
    if (d.clientId) {
      const { data: existing } = await db.from("payments").select("id, system_no").eq("client_id", d.clientId).maybeSingle();
      if (existing) return { id: existing.id, systemNo: existing.system_no ?? "", duplicate: true, creditFils: 0 };
    }
    const { data: c } = await db.from("contracts").select("id, org_id, tenant_id, status, contract_no, properties(name), contract_units(units(label))").eq("id", d.contractId).single();
    if (!c) throw new ActionError("notFound");
    if (c.status === "draft") throw new ActionError("contract_not_live");
    if (d.receiptNo && ctx.settings.receiptDuplicatePolicy === "block" && (await checkReceiptNo(d.receiptNo))) throw new ActionError("duplicate_receipt");
    const { data: balances } = await db.from("v_charge_balances").select("charge_id, period, kind, due_date, outstanding_fils").eq("contract_id", d.contractId).gt("outstanding_fils", 0);
    const open = (balances ?? []).map((b) => ({ id: b.charge_id!, period: b.period!, kind: b.kind!, dueDate: b.due_date!, outstandingFils: b.outstanding_fils! }));
    const result =
      d.allocation.mode === "fifo"
        ? allocateFIFO(d.amountFils, open)
        : d.allocation.mode === "periods"
          ? allocateToPeriods(d.amountFils, open, d.allocation.periods)
          : allocateManual(d.amountFils, open, d.allocation.lines.filter((l) => l.amountFils > 0));
    const year = Number(d.receivedAt.slice(0, 4));
    const { data: seq, error: seqErr } = await db.rpc("next_number", { p_org: ctx.orgId, p_key: "receipt", p_year: year });
    if (seqErr) throw seqErr;
    const systemNo = formatSequenceNo(ctx.settings.numbering.receipt, year, seq as number);
    const { data: pay, error } = await db
      .from("payments")
      .insert({
        org_id: ctx.orgId,
        tenant_id: c.tenant_id,
        contract_id: c.id,
        amount_fils: d.amountFils,
        method: d.method,
        received_at: d.receivedAt,
        receipt_no: d.receiptNo || null,
        system_no: systemNo,
        reference: d.reference || null,
        collected_by: d.collectedBy ?? ctx.userId,
        notes: d.notes || null,
        client_id: d.clientId ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505" && d.clientId) {
        const { data: existing } = await db.from("payments").select("id, system_no").eq("client_id", d.clientId).single();
        return { id: existing!.id, systemNo: existing!.system_no ?? "", duplicate: true, creditFils: 0 };
      }
      throw error;
    }
    if (result.allocations.length) {
      const al = await db.from("payment_allocations").insert(result.allocations.map((a) => ({ org_id: ctx.orgId, payment_id: pay.id, charge_id: a.chargeId, amount_fils: a.amountFils })));
      if (al.error) {
        await db.from("payments").delete().eq("id", pay.id);
        throw al.error;
      }
    }
    const units = (c.contract_units ?? []).map((u) => (u.units as unknown as { label: string }).label).join(", ");
    await notifyEvent(ctx, "payment_recorded", {
      amountFils: d.amountFils,
      propertyName: (c.properties as unknown as { name: string }).name,
      unitLabels: units,
      collector: ctx.displayName,
      url: `/payments/${pay.id}`,
      entityId: pay.id,
      propertyId: null,
      contractId: c.id,
    }).catch(() => {});
    reval();
    return { id: pay.id, systemNo, duplicate: false, creditFils: result.creditFils };
  });
}

/** Bulk "mark as fully paid": one payment per contract for its due amount, same date and method. */
export async function bulkMarkPaid(input: { rows: { contractId: string; receiptNo?: string | null }[]; receivedAt: string; method: (typeof PAYMENT_METHODS)[number]; period: string }) {
  return run(async () => {
    const ctx = await requireActionContext("record_payment");
    const db = await supabaseServer();
    const results: { contractId: string; ok: boolean; error?: string }[] = [];
    for (const row of input.rows) {
      const { data: balances } = await db.from("v_charge_balances").select("outstanding_fils, due_date, period").eq("contract_id", row.contractId).gt("outstanding_fils", 0).lte("period", input.period);
      const amount = (balances ?? []).reduce((a, b) => a + (b.outstanding_fils ?? 0), 0);
      if (amount <= 0) {
        results.push({ contractId: row.contractId, ok: true });
        continue;
      }
      const r = await recordPayment({ contractId: row.contractId, amountFils: amount, method: input.method, receivedAt: input.receivedAt, receiptNo: row.receiptNo ?? null, allocation: { mode: "fifo" }, collectedBy: ctx.userId });
      results.push({ contractId: row.contractId, ok: r.ok, error: r.ok ? undefined : r.error });
    }
    reval();
    return results;
  });
}

export async function voidPayment(id: string, reason: string) {
  return run(async () => {
    await requireActionContext("void_payment");
    if (!reason.trim()) throw new ActionError("validation");
    const db = await supabaseServer();
    const { error } = await db.rpc("void_payment", { p_payment: id, p_reason: reason.trim() });
    if (error) throw error;
    reval();
  });
}

const adjustmentSchema = z.object({
  contractId: z.string().uuid(),
  chargeId: z.string().uuid().nullable(),
  kind: z.enum(["discount", "write_off", "correction"]),
  amountFils: z.number().int().positive("positive"),
  date: isoDate,
  reason: z.string().trim().min(1, "required").max(500),
});

/** Discount / write-off / correction with a mandatory reason (shown in reports). */
export async function addAdjustment(input: z.input<typeof adjustmentSchema>) {
  return run(async () => {
    const ctx = await requireActionContext("void_payment");
    const d = adjustmentSchema.parse(input);
    const db = await supabaseServer();
    if (d.chargeId) {
      const { data: b } = await db.from("v_charge_balances").select("outstanding_fils").eq("charge_id", d.chargeId).single();
      if (!b || d.amountFils > (b.outstanding_fils ?? 0)) throw new ActionError("exceeds_outstanding");
    }
    const { error } = await db.from("adjustments").insert({ org_id: ctx.orgId, contract_id: d.contractId, charge_id: d.chargeId, kind: d.kind, amount_fils: d.amountFils, adjustment_date: d.date, reason: d.reason, approved_by: ctx.userId });
    if (error) throw error;
    reval();
  });
}

/** Adds a manual charge (penalty, maintenance recharge, other). */
export async function addManualCharge(input: { contractId: string; kind: "penalty" | "maintenance_recharge" | "other"; amountFils: number; dueDate: string; description: string }) {
  return run(async () => {
    const ctx = await requireActionContext("manage_contracts");
    const d = z
      .object({ contractId: z.string().uuid(), kind: z.enum(["penalty", "maintenance_recharge", "other"]), amountFils: z.number().int().positive(), dueDate: isoDate, description: z.string().trim().min(1).max(300) })
      .parse(input);
    const db = await supabaseServer();
    const { error } = await db.from("charges").insert({ org_id: ctx.orgId, contract_id: d.contractId, period: periodOf(d.dueDate), kind: d.kind, amount_fils: d.amountFils, due_date: d.dueDate, description: d.description });
    if (error) throw error;
    const { applyCredit } = await import("@/server/billing/ensure-charges");
    await applyCredit(ctx.orgId, [d.contractId]);
    reval();
  });
}

export async function closeMonth(period: string, notes: string | null, cashDifferenceNote?: string | null) {
  return run(async () => {
    const ctx = await requireActionContext("close_month");
    const db = await supabaseServer();
    const { error } = await db.from("monthly_closings").insert({ org_id: ctx.orgId, period, notes, cash_difference_note: cashDifferenceNote ?? null, closed_by: ctx.userId });
    if (error) throw error;
    reval();
  });
}

export async function reopenMonth(period: string) {
  return run(async () => {
    const ctx = await requireActionContext("reopen_month");
    const db = await supabaseServer();
    const { error } = await db.from("monthly_closings").delete().eq("org_id", ctx.orgId).eq("period", period);
    if (error) throw error;
    reval();
  });
}

/** Builds the Arabic/English reminder text from the org template. */
export async function buildReminder(contractId: string, locale: "ar" | "en") {
  return run(async () => {
    const ctx = await requireActionContext("send_reminder");
    const db = await supabaseServer();
    const today = todayKuwait();
    const [{ data: c }, { data: bal }] = await Promise.all([
      db.from("contracts").select("id, tenant_id, tenants(full_name, phones), properties(name), contract_units(units(label))").eq("id", contractId).single(),
      db.from("v_charge_balances").select("period, outstanding_fils, due_date").eq("contract_id", contractId).gt("outstanding_fils", 0).lte("due_date", today).order("period"),
    ]);
    if (!c) throw new ActionError("notFound");
    const amount = (bal ?? []).reduce((a, b) => a + (b.outstanding_fils ?? 0), 0);
    const months = [...new Set((bal ?? []).map((b) => b.period!))].map((p) => formatPeriod(p, locale)).join(locale === "ar" ? "، " : ", ");
    const tn = c.tenants as unknown as { full_name: string; phones: string[] };
    const template = locale === "ar" ? ctx.settings.reminderTemplateAr : ctx.settings.reminderTemplateEn;
    const vars: Record<string, string> = {
      tenant_name: tn.full_name,
      amount: fromFils(amount),
      months,
      unit: (c.contract_units ?? []).map((u) => (u.units as unknown as { label: string }).label).join(", "),
      property: (c.properties as unknown as { name: string }).name,
      org_name: locale === "en" && ctx.orgNameEn ? ctx.orgNameEn : ctx.orgName,
    };
    const message = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
    return { message, phone: tn.phones?.[0] ?? null, tenantId: c.tenant_id, amountFils: amount };
  });
}

export async function logReminder(input: { tenantId: string; contractId: string | null; message: string; channel: "whatsapp" | "copy" | "sms" | "call" }) {
  return run(async () => {
    const ctx = await requireActionContext("send_reminder");
    const db = await supabaseServer();
    const { error } = await db.from("reminders_log").insert({ org_id: ctx.orgId, tenant_id: input.tenantId, contract_id: input.contractId, channel: input.channel, message: input.message, sent_by: ctx.userId });
    if (error) throw error;
    reval();
  });
}
