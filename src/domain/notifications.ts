/**
 * Scheduled notification rules (§19.5), pure: given the org dataset and "today"
 * (Kuwait), decide which time-based events are due. Each event carries a dedupe
 * key so the hourly cron can run repeatedly and still notify exactly once.
 */
import { addDays, formatDate, periodOf, addPeriods, type ISODate, type Period } from "./dates";
import {
  Index,
  expiringContracts,
  lateUnits,
  monthlySummary,
  upcomingFirstCollections,
  type Dataset,
} from "./reports";
import { chargeStates } from "./ledger";

export type ScheduledType =
  "tenant_late" | "grace_ending" | "contract_expiring" | "hearing_tomorrow" | "month_end";

export interface ScheduledEvent {
  type: ScheduledType;
  dedupeKey: string;
  url: string;
  contractId?: string;
  propertyId?: string;
  entityId?: string;
  amountFils?: number;
  vars: Record<string, string | number>;
}

export interface ScheduleOptions {
  /** Days-late thresholds that trigger a "tenant late" alert (org setting). */
  lateDays: readonly number[];
  /** Periods already closed (month-end reminder is skipped for them). */
  closedPeriods: readonly Period[];
  /** Tenant names for legal cases. */
  tenantName?: (tenantId: string) => string;
}

export const EXPIRY_BUCKETS = [30, 60, 90] as const;

/** Highest threshold that `days` has reached, or null. */
export function reachedThreshold(days: number, thresholds: readonly number[]): number | null {
  const hit = [...thresholds].sort((a, b) => a - b).filter((t) => days >= t);
  return hit.length ? hit[hit.length - 1]! : null;
}

/** 30 / 60 / 90-day window a contract end date falls in, or null if beyond 90. */
export function expiryBucket(daysLeft: number): number | null {
  return EXPIRY_BUCKETS.find((b) => daysLeft <= b) ?? null;
}

export function scheduledEvents(
  ds: Dataset | Index,
  today: ISODate,
  opts: ScheduleOptions,
): ScheduledEvent[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const out: ScheduledEvent[] = [];

  for (const r of lateUnits(idx, today)) {
    const t = reachedThreshold(r.daysLate, opts.lateDays);
    if (t === null) continue;
    out.push({
      type: "tenant_late",
      dedupeKey: `late:${r.contractId}:${r.oldestDueDate}:${t}`,
      url: `/contracts/${r.contractId}`,
      contractId: r.contractId,
      propertyId: r.propertyId,
      entityId: r.contractId,
      amountFils: r.amountFils,
      vars: {
        tenant: r.tenantName,
        days: r.daysLate,
        property: r.propertyName,
        unit: r.unitLabels,
      },
    });
  }

  for (const g of upcomingFirstCollections(idx, today, 7)) {
    out.push({
      type: "grace_ending",
      dedupeKey: `grace:${g.contractId}:${g.firstCollectionDate}`,
      url: `/contracts/${g.contractId}`,
      contractId: g.contractId,
      entityId: g.contractId,
      vars: {
        tenant: g.tenantName,
        date: formatDate(g.firstCollectionDate),
        property: g.propertyName,
        unit: g.unitLabels,
      },
    });
  }

  for (const e of expiringContracts(idx, today, 90)) {
    const bucket = expiryBucket(e.daysLeft);
    if (bucket === null || e.daysLeft < 0) continue;
    out.push({
      type: "contract_expiring",
      dedupeKey: `expiring:${e.contractId}:${e.endDate}:${bucket}`,
      url: `/contracts/${e.contractId}`,
      contractId: e.contractId,
      entityId: e.contractId,
      vars: {
        tenant: e.tenantName,
        contract: e.contractNo,
        days: e.daysLeft,
        date: formatDate(e.endDate),
        property: e.propertyName,
        unit: e.unitLabels,
      },
    });
  }

  const tomorrow = addDays(today, 1);
  for (const l of idx.ds.legalCases) {
    if (l.nextHearingDate !== tomorrow || l.status === "closed" || l.status === "none") continue;
    out.push({
      type: "hearing_tomorrow",
      dedupeKey: `hearing:${l.id}:${tomorrow}`,
      url: `/legal/${l.id}`,
      contractId: l.contractId ?? undefined,
      entityId: l.id,
      vars: {
        case: l.caseNo ?? "",
        tenant: opts.tenantName?.(l.tenantId) ?? "",
        date: formatDate(tomorrow),
      },
    });
  }

  // First three days of a month: remind to close last month (with its cash difference).
  const day = Number(today.slice(8, 10));
  const prev = addPeriods(periodOf(today), -1);
  if (day <= 3 && !opts.closedPeriods.includes(prev)) {
    const s = monthlySummary(idx, prev);
    out.push({
      type: "month_end",
      dedupeKey: `monthend:${prev}`,
      url: `/collections?period=${prev}`,
      amountFils: s.differenceFils,
      vars: { month: `${prev.slice(5, 7)}/${prev.slice(0, 4)}` },
    });
  }
  return out;
}

/** Morning digest numbers: payments due today, late units and their total. */
export function digestSummary(
  ds: Dataset | Index,
  today: ISODate,
): { due: number; late: number; amountFils: number } {
  const idx = ds instanceof Index ? ds : new Index(ds);
  let due = 0;
  for (const c of idx.ds.contracts) {
    if (c.status !== "active" && c.status !== "notice_given") continue;
    const states = chargeStates(idx.ledger(c.id), today);
    if ([...states.values()].some((s) => s.charge.dueDate === today && s.outstandingFils > 0))
      due++;
  }
  // Rent falling due today isn't "late" yet.
  const late = lateUnits(idx, today).filter((r) => r.daysLate > 0);
  return { due, late: late.length, amountFils: late.reduce((a, r) => a + r.amountFils, 0) };
}
