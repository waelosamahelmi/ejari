/** Expense voucher lines and their allocation across properties. */
import { splitByWeights, splitEven, sum, type Fils } from "./money";

export const ALLOCATION_MODES = [
  "single",
  "split_even",
  "split_by_units",
  "split_by_rent",
  "manual_percent",
  "manual_amount",
] as const;
export type AllocationMode = (typeof ALLOCATION_MODES)[number];

export const EXPENSE_CATEGORY_TYPES = ["operating", "capital", "payroll", "owner_draw"] as const;
export type ExpenseCategoryType = (typeof EXPENSE_CATEGORY_TYPES)[number];

export interface AllocationTarget {
  propertyId: string;
  unitId?: string | null;
  /** split_by_units: number of units in the property. */
  unitCount?: number;
  /** split_by_rent: expected rent of the period in fils. */
  expectedRentFils?: Fils;
  /** manual_percent: percentage (0–100, up to 2 decimals). */
  percent?: number;
  /** manual_amount: amount in fils. */
  amountFils?: Fils;
}

export interface ExpenseAllocation {
  propertyId: string;
  unitId: string | null;
  amountFils: Fils;
}

export class ExpenseAllocationError extends Error {
  constructor(
    public readonly code: "no_targets" | "single_needs_one" | "percent_sum" | "amount_sum" | "negative",
    message: string,
  ) {
    super(message);
    this.name = "ExpenseAllocationError";
  }
}

/** Allocates one line amount to properties; the result always sums to `amount`. */
export function allocateExpenseLine(
  amount: Fils,
  mode: AllocationMode,
  targets: readonly AllocationTarget[],
): ExpenseAllocation[] {
  if (amount < 0) throw new ExpenseAllocationError("negative", "Amount must be >= 0");
  if (targets.length === 0) throw new ExpenseAllocationError("no_targets", "At least one property is required");
  const mk = (t: AllocationTarget, a: Fils): ExpenseAllocation => ({
    propertyId: t.propertyId,
    unitId: t.unitId ?? null,
    amountFils: a,
  });
  switch (mode) {
    case "single": {
      if (targets.length !== 1) throw new ExpenseAllocationError("single_needs_one", "Single mode needs exactly one property");
      return [mk(targets[0]!, amount)];
    }
    case "split_even": {
      const parts = splitEven(amount, targets.length);
      return targets.map((t, i) => mk(t, parts[i]!));
    }
    case "split_by_units": {
      const parts = splitByWeights(
        amount,
        targets.map((t) => Math.max(0, t.unitCount ?? 0)),
      );
      return targets.map((t, i) => mk(t, parts[i]!));
    }
    case "split_by_rent": {
      const parts = splitByWeights(
        amount,
        targets.map((t) => Math.max(0, t.expectedRentFils ?? 0)),
      );
      return targets.map((t, i) => mk(t, parts[i]!));
    }
    case "manual_percent": {
      const pcts = targets.map((t) => t.percent ?? 0);
      if (pcts.some((p) => p < 0)) throw new ExpenseAllocationError("negative", "Percent must be >= 0");
      const basis = pcts.map((p) => Math.round(p * 100));
      if (basis.reduce((a, b) => a + b, 0) !== 10_000) {
        throw new ExpenseAllocationError("percent_sum", "Percentages must sum to 100");
      }
      const parts = splitByWeights(amount, basis);
      return targets.map((t, i) => mk(t, parts[i]!));
    }
    case "manual_amount": {
      const amounts = targets.map((t) => t.amountFils ?? 0);
      if (amounts.some((a) => a < 0)) throw new ExpenseAllocationError("negative", "Amounts must be >= 0");
      if (sum(amounts) !== amount) throw new ExpenseAllocationError("amount_sum", "Amounts must sum to the line amount");
      return targets.map((t, i) => mk(t, amounts[i]!));
    }
  }
}

export interface VoucherLineInput {
  amountFils: Fils;
}

export function voucherTotal(lines: readonly VoucherLineInput[]): Fils {
  return sum(lines.map((l) => l.amountFils));
}

/** Aggregates allocations per property. */
export function totalsByProperty(allocs: readonly ExpenseAllocation[]): Map<string, Fils> {
  const m = new Map<string, Fils>();
  for (const a of allocs) m.set(a.propertyId, (m.get(a.propertyId) ?? 0) + a.amountFils);
  return m;
}
