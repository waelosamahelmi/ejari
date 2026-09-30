/**
 * Rent schedule generation: one charge per calendar month per kind.
 * Pure and idempotent — the caller upserts on (contract, period, kind).
 */
import {
  addPeriods,
  diffDays,
  diffPeriods,
  maxDate,
  minDate,
  periodDays,
  periodEnd,
  periodOf,
  periodRange,
  periodStart,
  type ISODate,
  type Period,
} from "./dates";
import { mulRound, type Fils } from "./money";
import type { ChargeKind } from "./types";

export interface RentRevision {
  effectiveFrom: ISODate;
  monthlyRentFils: Fils;
}

export interface AnnualIncrease {
  kind: "percent" | "fixed";
  /** percent: e.g. 5 for 5 %; fixed: fils added per step. */
  value: number;
  everyMonths: number;
}

export interface ScheduleContract {
  startDate: ISODate;
  endDate: ISODate;
  firstCollectionDate: ISODate;
  monthlyRentFils: Fils;
  electricityFixedFils?: Fils;
  revisions?: readonly RentRevision[];
  annualIncrease?: AnnualIncrease | null;
  moveOutDate?: ISODate | null;
}

export interface ScheduleOptions {
  /** Prorate partial first/last months by days (org setting). Default: full month. */
  prorate?: boolean;
  /** Only generate up to and including this period. */
  until?: Period;
  /** Only generate from this period onwards. */
  from?: Period;
}

export interface ScheduledCharge {
  period: Period;
  kind: Extract<ChargeKind, "rent" | "free" | "electricity_fixed">;
  amountFils: Fils;
  waivedValueFils: Fils;
  dueDate: ISODate;
}

/** Last day the tenant is billed for. */
export function effectiveEndDate(c: Pick<ScheduleContract, "endDate" | "moveOutDate">): ISODate {
  return c.moveOutDate ? minDate(c.endDate, c.moveOutDate) : c.endDate;
}

/** Number of free (grace) months before the first collection month. */
export function graceMonths(startDate: ISODate, firstCollectionDate: ISODate): number {
  return Math.max(0, diffPeriods(periodOf(startDate), periodOf(firstCollectionDate)));
}

/** Monthly rent in effect for a period, applying revisions and automatic increases. */
export function rentForPeriod(c: ScheduleContract, period: Period): Fils {
  const pStart = periodStart(period);
  const revisions = [...(c.revisions ?? [])]
    .filter((r) => r.effectiveFrom <= pStart || periodOf(r.effectiveFrom) === period)
    .sort((a, b) =>
      a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0,
    );
  const latest = revisions.at(-1);
  const anchorDate = latest ? latest.effectiveFrom : c.startDate;
  let rent = latest ? latest.monthlyRentFils : c.monthlyRentFils;
  const inc = c.annualIncrease;
  if (inc && inc.everyMonths > 0 && inc.value > 0) {
    const startP = periodOf(c.startDate);
    const stepsAt = (p: Period) =>
      Math.max(0, Math.floor(diffPeriods(startP, p) / inc.everyMonths));
    const steps = stepsAt(period) - stepsAt(periodOf(anchorDate));
    for (let i = 0; i < steps; i++) {
      rent =
        inc.kind === "percent" ? mulRound(rent, 1 + inc.value / 100) : rent + Math.round(inc.value);
    }
  }
  return rent;
}

function prorated(amount: Fils, period: Period, from: ISODate, to: ISODate): Fils {
  const pS = periodStart(period);
  const pE = periodEnd(period);
  const s = maxDate(pS, from);
  const e = minDate(pE, to);
  const days = diffDays(s, e) + 1;
  const total = periodDays(period);
  if (days >= total) return amount;
  return mulRound(amount, days / total);
}

/** Generates all charges for a contract (optionally clipped by from/until). */
export function generateSchedule(
  c: ScheduleContract,
  opts: ScheduleOptions = {},
): ScheduledCharge[] {
  if (c.firstCollectionDate < c.startDate)
    throw new RangeError("first_collection_date must be >= start_date");
  const end = effectiveEndDate(c);
  if (end < c.startDate) return [];
  const startP = periodOf(c.startDate);
  const endP = periodOf(end);
  const firstP = periodOf(c.firstCollectionDate);
  const fromP = opts.from && opts.from > startP ? opts.from : startP;
  const toP = opts.until && opts.until < endP ? opts.until : endP;
  const out: ScheduledCharge[] = [];
  const elec = c.electricityFixedFils ?? 0;

  for (const period of periodRange(fromP, toP)) {
    const rent = rentForPeriod(c, period);
    if (period < firstP) {
      out.push({
        period,
        kind: "free",
        amountFils: 0,
        waivedValueFils: rent,
        dueDate: periodStart(period),
      });
      continue;
    }
    const isFirst = period === firstP;
    const billFrom = isFirst ? c.firstCollectionDate : periodStart(period);
    let amount = rent;
    if (opts.prorate) amount = prorated(rent, period, billFrom, end);
    const due = isFirst ? c.firstCollectionDate : periodStart(period);
    out.push({ period, kind: "rent", amountFils: amount, waivedValueFils: 0, dueDate: due });
    if (elec > 0) {
      const e = opts.prorate ? prorated(elec, period, billFrom, end) : elec;
      out.push({
        period,
        kind: "electricity_fixed",
        amountFils: e,
        waivedValueFils: 0,
        dueDate: due,
      });
    }
  }
  return out;
}

/** Periods for which charges should exist by `until` (inclusive), used by the nightly job. */
export function periodsToMaterialize(c: ScheduleContract, until: Period): Period[] {
  const end = effectiveEndDate(c);
  const last = periodOf(end) < until ? periodOf(end) : until;
  return periodRange(periodOf(c.startDate), last);
}

/** Next period helper re-exported for callers building "until" windows. */
export function nextPeriod(p: Period): Period {
  return addPeriods(p, 1);
}
