import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addPeriods, periodOf, todayKuwait, type Period } from "@/domain/dates";
import { generateSchedule } from "@/domain/schedule";
import { fetchAll } from "@/server/db";
import type { OrgSettings } from "@/lib/auth";

/** How far ahead charges are materialized (current month + 3). */
export const MATERIALIZE_AHEAD = 3;

const lastRun = new Map<string, number>();

/**
 * ensure_charges_until(org, period): idempotently materializes rent / free /
 * fixed-electricity charges for every live contract through `until`.
 * Implemented in TS on top of domain/schedule.ts (see DECISIONS.md).
 */
export async function ensureChargesUntil(orgId: string, until: Period, settings?: Pick<OrgSettings, "proration">, contractIds?: string[]) {
  const db = supabaseAdmin();
  let q = db
    .from("contracts")
    .select("id, org_id, start_date, end_date, first_collection_date, monthly_rent_fils, electricity_fixed_fils, move_out_date, status, annual_increase_kind, annual_increase_value, annual_increase_every_months, contract_rent_revisions(effective_from, monthly_rent_fils), contract_units(unit_id)")
    .eq("org_id", orgId)
    .in("status", ["active", "notice_given", "ended", "terminated", "renewed"]);
  if (contractIds?.length) q = q.in("id", contractIds);
  const { data: contracts, error } = await q;
  if (error) throw error;
  if (!contracts?.length) return 0;
  const ids = contracts.map((c) => c.id);
  const existing = await fetchAll((from, to) =>
    db.from("charges").select("contract_id, period, kind").in("contract_id", ids).eq("voided", false).in("kind", ["rent", "free", "electricity_fixed"]).range(from, to),
  );
  const have = new Set(existing.map((e) => `${e.contract_id}|${e.period}|${e.kind}`));
  const { data: closings } = await db.from("monthly_closings").select("period").eq("org_id", orgId);
  const closed = new Set((closings ?? []).map((c) => c.period));
  const rows: {
    org_id: string;
    contract_id: string;
    unit_id: string | null;
    period: string;
    kind: "rent" | "free" | "electricity_fixed";
    amount_fils: number;
    waived_value_fils: number;
    due_date: string;
  }[] = [];
  for (const c of contracts) {
    const schedule = generateSchedule(
      {
        startDate: c.start_date,
        endDate: c.end_date,
        firstCollectionDate: c.first_collection_date,
        monthlyRentFils: c.monthly_rent_fils,
        electricityFixedFils: c.electricity_fixed_fils,
        moveOutDate: c.move_out_date,
        revisions: (c.contract_rent_revisions ?? []).map((r) => ({ effectiveFrom: r.effective_from, monthlyRentFils: r.monthly_rent_fils })),
        annualIncrease:
          c.annual_increase_kind && c.annual_increase_value && c.annual_increase_every_months
            ? { kind: c.annual_increase_kind, value: Number(c.annual_increase_value), everyMonths: c.annual_increase_every_months }
            : null,
      },
      { until, prorate: settings?.proration ?? false },
    );
    const units = c.contract_units ?? [];
    for (const s of schedule) {
      if (have.has(`${c.id}|${s.period}|${s.kind}`) || closed.has(s.period)) continue;
      rows.push({
        org_id: c.org_id,
        contract_id: c.id,
        unit_id: units.length === 1 ? units[0]!.unit_id : null,
        period: s.period,
        kind: s.kind,
        amount_fils: s.amountFils,
        waived_value_fils: s.waivedValueFils,
        due_date: s.dueDate,
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from("charges").insert(rows.slice(i, i + 500));
    // A concurrent run may have inserted the same charge: ignore unique violations and retry one by one.
    if (e && e.code === "23505") {
      for (const r of rows.slice(i, i + 500)) await db.from("charges").insert(r);
    } else if (e) throw e;
  }
  if (rows.length) await applyCredit(orgId, [...new Set(rows.map((r) => r.contract_id))]);
  return rows.length;
}

/** Throttled: at most once per 10 minutes per org per process (nightly cron does the rest). */
export async function ensureChargesFresh(orgId: string, settings?: Pick<OrgSettings, "proration">) {
  const now = Date.now();
  if ((lastRun.get(orgId) ?? 0) > now - 10 * 60_000) return;
  lastRun.set(orgId, now);
  try {
    await ensureChargesUntil(orgId, addPeriods(periodOf(todayKuwait()), MATERIALIZE_AHEAD), settings);
  } catch (e) {
    lastRun.delete(orgId);
    console.error("[ensureCharges]", e);
  }
}

/**
 * Tenant credit (unallocated payments) is consumed automatically by new charges:
 * allocates each contract's credit FIFO against its open charges.
 */
export async function applyCredit(orgId: string, contractIds: string[]) {
  const { allocateFIFO } = await import("@/domain/allocation");
  const db = supabaseAdmin();
  for (const id of contractIds) {
    const [{ data: payments }, { data: balances }] = await Promise.all([
      db.from("payments").select("id, amount_fils, received_at, payment_allocations(amount_fils)").eq("contract_id", id).eq("voided", false).order("received_at"),
      db.from("v_charge_balances").select("charge_id, period, kind, due_date, outstanding_fils, amount_fils").eq("contract_id", id).gt("outstanding_fils", 0),
    ]);
    if (!payments?.length || !balances?.length) continue;
    const open = balances.map((b) => ({ id: b.charge_id!, period: b.period!, kind: b.kind!, dueDate: b.due_date!, outstandingFils: b.outstanding_fils! }));
    for (const p of payments) {
      const credit = p.amount_fils - (p.payment_allocations ?? []).reduce((s, a) => s + a.amount_fils, 0);
      if (credit <= 0) continue;
      const r = allocateFIFO(credit, open);
      if (!r.allocations.length) continue;
      const { error } = await db.from("payment_allocations").insert(r.allocations.map((a) => ({ org_id: orgId, payment_id: p.id, charge_id: a.chargeId, amount_fils: a.amountFils })));
      if (error) throw error;
      for (const a of r.allocations) {
        const o = open.find((x) => x.id === a.chargeId)!;
        o.outstandingFils -= a.amountFils;
      }
    }
  }
}
