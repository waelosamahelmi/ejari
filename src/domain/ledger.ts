/**
 * Ledger: balances, arrears, per-period statuses, aging and running balances.
 * All functions are "as of" a date so statements can be reproduced historically.
 */
import { diffDays, periodEnd, periodStart, type ISODate, type Period } from "./dates";
import type { Fils } from "./money";
import type { Adjustment, Allocation, Charge, Payment, PeriodStatus } from "./types";

export interface LedgerInput {
  charges: readonly Charge[];
  payments: readonly Payment[];
  allocations: readonly Allocation[];
  adjustments?: readonly Adjustment[];
}

interface ChargeState {
  charge: Charge;
  allocatedFils: Fils;
  adjustedFils: Fils;
  outstandingFils: Fils;
  /** Payment dates contributing to this charge. */
  paymentDates: ISODate[];
}

function activeCharges(charges: readonly Charge[]): Charge[] {
  return charges.filter((c) => !c.voided);
}

/** Per-charge state considering only payments received and adjustments dated ≤ asOf. */
export function chargeStates(input: LedgerInput, asOf?: ISODate): Map<string, ChargeState> {
  const paymentsById = new Map(input.payments.filter((p) => !p.voided).map((p) => [p.id, p]));
  const states = new Map<string, ChargeState>();
  for (const c of activeCharges(input.charges)) {
    states.set(c.id, {
      charge: c,
      allocatedFils: 0,
      adjustedFils: 0,
      outstandingFils: c.amountFils,
      paymentDates: [],
    });
  }
  for (const a of input.allocations) {
    const p = paymentsById.get(a.paymentId);
    const s = states.get(a.chargeId);
    if (!p || !s) continue;
    if (asOf && p.receivedAt > asOf) continue;
    s.allocatedFils += a.amountFils;
    s.paymentDates.push(p.receivedAt);
  }
  for (const adj of input.adjustments ?? []) {
    if (!adj.chargeId) continue;
    const s = states.get(adj.chargeId);
    if (!s) continue;
    if (asOf && adj.date > asOf) continue;
    s.adjustedFils += adj.amountFils;
  }
  for (const s of states.values()) {
    s.outstandingFils = Math.max(0, s.charge.amountFils - s.allocatedFils - s.adjustedFils);
  }
  return states;
}

/** Arrears as of D = Σ outstanding of charges due ≤ D (payments/adjustments ≤ D). */
export function arrearsAsOf(input: LedgerInput, asOf: ISODate): Fils {
  let total = 0;
  for (const s of chargeStates(input, asOf).values()) {
    if (s.charge.dueDate <= asOf) total += s.outstandingFils;
  }
  // Unlinked adjustments (write-offs against the contract balance) reduce arrears too.
  for (const adj of input.adjustments ?? []) {
    if (!adj.chargeId && adj.date <= asOf) total -= adj.amountFils;
  }
  return Math.max(0, total);
}

/** Unpaid charges due ≤ asOf, oldest first. */
export function overdueCharges(input: LedgerInput, asOf: ISODate): ChargeState[] {
  return [...chargeStates(input, asOf).values()]
    .filter((s) => s.charge.dueDate <= asOf && s.outstandingFils > 0 && s.charge.amountFils > 0)
    .sort((a, b) => a.charge.dueDate.localeCompare(b.charge.dueDate));
}

/** Days late = asOf − due date of the oldest unpaid charge (0 when nothing is overdue). */
export function daysLate(input: LedgerInput, asOf: ISODate): number {
  const oldest = overdueCharges(input, asOf)[0];
  return oldest ? Math.max(0, diffDays(oldest.charge.dueDate, asOf)) : 0;
}

/** Distinct overdue periods (months overdue). */
export function monthsOverdue(input: LedgerInput, asOf: ISODate): number {
  return new Set(overdueCharges(input, asOf).map((s) => s.charge.period)).size;
}

export interface AgingBuckets {
  d0_30: Fils;
  d31_60: Fils;
  d61_90: Fils;
  d90_plus: Fils;
}

export function aging(input: LedgerInput, asOf: ISODate): AgingBuckets {
  const b: AgingBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const s of overdueCharges(input, asOf)) {
    const days = diffDays(s.charge.dueDate, asOf);
    if (days <= 30) b.d0_30 += s.outstandingFils;
    else if (days <= 60) b.d31_60 += s.outstandingFils;
    else if (days <= 90) b.d61_90 += s.outstandingFils;
    else b.d90_plus += s.outstandingFils;
  }
  return b;
}

export function agingBucketOf(days: number): keyof AgingBuckets {
  if (days <= 30) return "d0_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

export interface PeriodStatusOptions {
  /** Contract exists for this period; if false the status is `vacant`. */
  occupied?: boolean;
  /** An open legal case overrides unpaid/partial. */
  legal?: boolean;
}

/**
 * Status of one period of one contract as of `asOf`:
 * paid, partial, unpaid, due, advance, free, vacant, legal.
 */
export function periodStatus(
  input: LedgerInput,
  period: Period,
  asOf: ISODate,
  opts: PeriodStatusOptions = {},
): PeriodStatus {
  if (opts.occupied === false) return "vacant";
  const states = [...chargeStates(input, asOf).values()].filter((s) => s.charge.period === period);
  if (states.length === 0) return "vacant";
  const billable = states.filter((s) => s.charge.amountFils > 0);
  if (billable.length === 0) return "free";
  const amount = billable.reduce((a, s) => a + s.charge.amountFils, 0);
  const outstanding = billable.reduce((a, s) => a + s.outstandingFils, 0);
  const covered = amount - outstanding;
  const due = billable.reduce(
    (d, s) => (s.charge.dueDate < d ? s.charge.dueDate : d),
    billable[0]!.charge.dueDate,
  );
  if (outstanding === 0) {
    const dates = billable.flatMap((s) => s.paymentDates);
    const allBefore = dates.length > 0 && dates.every((d) => d < periodStart(period));
    return allBefore ? "advance" : "paid";
  }
  if (due > asOf) return "due";
  if (opts.legal) return "legal";
  return covered > 0 ? "partial" : "unpaid";
}

export interface LedgerEntry {
  date: ISODate;
  kind: "charge" | "payment" | "adjustment" | "free";
  refId: string;
  period?: Period;
  description: string;
  debitFils: Fils;
  creditFils: Fils;
  balanceFils: Fils;
}

/**
 * Tenant/contract ledger: every charge (debit), payment (credit) and adjustment
 * (credit) in date order with a running balance (positive = owed by tenant).
 */
export function buildLedger(input: LedgerInput, opts: { until?: ISODate } = {}): LedgerEntry[] {
  const rows: Omit<LedgerEntry, "balanceFils">[] = [];
  for (const c of activeCharges(input.charges)) {
    if (opts.until && c.dueDate > opts.until) continue;
    rows.push({
      date: c.dueDate,
      kind: c.kind === "free" ? "free" : "charge",
      refId: c.id,
      period: c.period,
      description: c.description ?? c.kind,
      debitFils: c.amountFils,
      creditFils: 0,
    });
  }
  for (const p of input.payments) {
    if (p.voided) continue;
    if (opts.until && p.receivedAt > opts.until) continue;
    rows.push({
      date: p.receivedAt,
      kind: "payment",
      refId: p.id,
      description: p.receiptNo ?? "",
      debitFils: 0,
      creditFils: p.amountFils,
    });
  }
  for (const a of input.adjustments ?? []) {
    if (opts.until && a.date > opts.until) continue;
    rows.push({
      date: a.date,
      kind: "adjustment",
      refId: a.id,
      description: a.reason,
      debitFils: 0,
      creditFils: a.amountFils,
    });
  }
  const order = { free: 0, charge: 1, adjustment: 2, payment: 3 } as const;
  rows.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);
  let balance = 0;
  return rows.map((r) => {
    balance += r.debitFils - r.creditFils;
    return { ...r, balanceFils: balance };
  });
}

/** Contract balance summary as of a date. */
export function balanceSummary(input: LedgerInput, asOf: ISODate) {
  const states = [...chargeStates(input, asOf).values()];
  const charged = states
    .filter((s) => s.charge.dueDate <= asOf)
    .reduce((a, s) => a + s.charge.amountFils, 0);
  const paid = input.payments
    .filter((p) => !p.voided && p.receivedAt <= asOf)
    .reduce((a, p) => a + p.amountFils, 0);
  const allocatedAll = states.reduce((a, s) => a + s.allocatedFils, 0);
  const arrears = arrearsAsOf(input, asOf);
  const credit = Math.max(0, paid - allocatedAll);
  return {
    chargedFils: charged,
    paidFils: paid,
    arrearsFils: arrears,
    creditFils: credit,
    net: arrears - credit,
  };
}

/** Last payment date ≤ asOf. */
export function lastPaymentDate(payments: readonly Payment[], asOf?: ISODate): ISODate | null {
  let last: ISODate | null = null;
  for (const p of payments) {
    if (p.voided) continue;
    if (asOf && p.receivedAt > asOf) continue;
    if (!last || p.receivedAt > last) last = p.receivedAt;
  }
  return last;
}

/** Convenience: arrears at end of a period. */
export function arrearsAtPeriodEnd(input: LedgerInput, period: Period): Fils {
  return arrearsAsOf(input, periodEnd(period));
}
