/**
 * Payment allocation. Default FIFO: oldest outstanding charge first (charges of
 * the same period together, rent before electricity), then future charges;
 * whatever is left becomes tenant credit (advance payment).
 */
import type { ISODate, Period } from "./dates";
import type { Fils } from "./money";
import type { ChargeKind } from "./types";

export interface OpenCharge {
  id: string;
  period: Period;
  kind: ChargeKind;
  dueDate: ISODate;
  /** Remaining balance (amount − allocations − adjustments). */
  outstandingFils: Fils;
}

export interface AllocationLine {
  chargeId: string;
  amountFils: Fils;
}

export interface AllocationResult {
  allocations: AllocationLine[];
  creditFils: Fils;
}

const KIND_ORDER: Record<ChargeKind, number> = {
  rent: 0,
  free: 1,
  electricity_fixed: 2,
  penalty: 3,
  maintenance_recharge: 4,
  other: 5,
};

export function sortChargesFIFO<T extends Pick<OpenCharge, "period" | "kind" | "dueDate" | "id">>(
  charges: readonly T[],
): T[] {
  return [...charges].sort(
    (a, b) =>
      a.period.localeCompare(b.period) ||
      a.dueDate.localeCompare(b.dueDate) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.id.localeCompare(b.id),
  );
}

function assertAmount(amount: Fils): void {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError("Payment amount must be a non-negative integer");
}

/** FIFO allocation of `amount` over open charges. */
export function allocateFIFO(amount: Fils, charges: readonly OpenCharge[]): AllocationResult {
  assertAmount(amount);
  let remaining = amount;
  const allocations: AllocationLine[] = [];
  for (const c of sortChargesFIFO(charges)) {
    if (remaining === 0) break;
    if (c.outstandingFils <= 0) continue;
    const take = Math.min(remaining, c.outstandingFils);
    allocations.push({ chargeId: c.id, amountFils: take });
    remaining -= take;
  }
  return { allocations, creditFils: remaining };
}

export class AllocationError extends Error {
  constructor(
    public readonly code: "unknown_charge" | "exceeds_outstanding" | "exceeds_payment" | "negative",
    message: string,
  ) {
    super(message);
    this.name = "AllocationError";
  }
}

/**
 * Manual allocation chosen by the user. Validates each line against the charge
 * outstanding and the payment total. The unallocated remainder becomes credit.
 */
export function allocateManual(
  amount: Fils,
  charges: readonly OpenCharge[],
  lines: readonly AllocationLine[],
): AllocationResult {
  assertAmount(amount);
  const byId = new Map(charges.map((c) => [c.id, c]));
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (l.amountFils < 0) throw new AllocationError("negative", "Allocation amounts must be >= 0");
    if (!byId.has(l.chargeId)) throw new AllocationError("unknown_charge", `Unknown charge ${l.chargeId}`);
    merged.set(l.chargeId, (merged.get(l.chargeId) ?? 0) + l.amountFils);
  }
  let total = 0;
  const allocations: AllocationLine[] = [];
  for (const c of sortChargesFIFO(charges)) {
    const a = merged.get(c.id);
    if (!a) continue;
    if (a > c.outstandingFils) throw new AllocationError("exceeds_outstanding", `Allocation exceeds charge ${c.id}`);
    total += a;
    allocations.push({ chargeId: c.id, amountFils: a });
  }
  if (total > amount) throw new AllocationError("exceeds_payment", "Allocations exceed the payment amount");
  return { allocations, creditFils: amount - total };
}

/**
 * Allocate `amount` to the listed periods only (payment sheet "choose periods"),
 * FIFO within those periods; remainder becomes credit.
 */
export function allocateToPeriods(
  amount: Fils,
  charges: readonly OpenCharge[],
  periods: readonly Period[],
): AllocationResult {
  const set = new Set(periods);
  return allocateFIFO(
    amount,
    charges.filter((c) => set.has(c.period)),
  );
}

/** Consume existing tenant credit against newly generated charges (FIFO). */
export function consumeCredit(creditFils: Fils, charges: readonly OpenCharge[]): AllocationResult {
  return allocateFIFO(creditFils, charges);
}

/**
 * Credit balance for a contract: payments − allocations. Voided payments and
 * their allocations are excluded by the caller.
 */
export function creditBalance(payments: readonly { amountFils: Fils }[], allocations: readonly { amountFils: Fils }[]): Fils {
  const p = payments.reduce((a, b) => a + b.amountFils, 0);
  const a = allocations.reduce((x, y) => x + y.amountFils, 0);
  return p - a;
}

/** Sum of amounts that are outstanding and due by `asOf`. */
export function amountDue(charges: readonly OpenCharge[], asOf: ISODate): Fils {
  return charges.filter((c) => c.dueDate <= asOf).reduce((a, c) => a + Math.max(0, c.outstandingFils), 0);
}
