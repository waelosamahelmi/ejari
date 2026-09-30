/**
 * Report aggregations over an in-memory dataset. The server loads rows for the
 * org (RLS-scoped) and every report is computed here, so the numbers on screen,
 * in print and in Excel always come from one tested implementation.
 */
import {
  addDays,
  diffDays,
  maxDate,
  minDate,
  periodEnd,
  periodOf,
  periodRange,
  periodStart,
  previousRange,
  type ISODate,
  type Period,
} from "./dates";
import { coversPeriod, isLive } from "./contracts";
import {
  arrearsAsOf,
  chargeStates,
  daysLate,
  lastPaymentDate,
  monthsOverdue,
  periodStatus,
  agingBucketOf,
  type LedgerInput,
} from "./ledger";
import { mulRound, splitByWeights, splitEven, type Fils } from "./money";
import {
  LEGAL_STATUS_LABELS_AR,
  type Adjustment,
  type Allocation,
  type Charge,
  type ContractStatus,
  type ContractType,
  type LegalStatus,
  type Payment,
  type PeriodStatus,
  type UnitType,
} from "./types";

// ================================================================ dataset

export interface RProperty {
  id: string;
  name: string;
  area?: string | null;
  ownerIds: readonly string[];
  ownerNames: readonly string[];
  commission?: { kind: "percent" | "fixed"; value: number } | null;
}

export interface RUnit {
  id: string;
  propertyId: string;
  label: string;
  sortOrder: number;
  type: UnitType;
  floor?: string | number | null;
  areaM2?: number | null;
  askingRentFils: Fils;
  active: boolean;
  availableFrom?: ISODate | null;
}

export interface RContract {
  id: string;
  contractNo: string;
  type: ContractType;
  status: ContractStatus;
  tenantId: string;
  tenantName: string;
  tenantPhones?: readonly string[];
  propertyId: string;
  unitIds: readonly string[];
  /** Optional per-unit rent shares (same order as unitIds). */
  unitShares?: readonly Fils[] | null;
  startDate: ISODate;
  endDate: ISODate;
  firstCollectionDate: ISODate;
  moveOutDate?: ISODate | null;
  monthlyRentFils: Fils;
  autoRenew?: boolean;
  noticeDate?: ISODate | null;
  expectedMoveOut?: ISODate | null;
  freeMonths?: number;
}

export interface RLegalCase {
  id: string;
  contractId: string | null;
  tenantId: string;
  status: LegalStatus;
  nextHearingDate?: ISODate | null;
  caseNo?: string | null;
}

export interface RExpenseAllocation {
  voucherId: string;
  voucherNo: string;
  voucherDate: ISODate;
  lineId: string;
  propertyId: string;
  unitId?: string | null;
  amountFils: Fils;
  categoryId: string;
  categoryName: string;
  categoryType?: string;
  beneficiaryId?: string | null;
  beneficiaryName?: string | null;
  description?: string | null;
}

export interface RVoucher {
  id: string;
  voucherNo: string;
  date: ISODate;
  totalFils: Fils;
  status: "draft" | "posted" | "void";
}

export interface RDeposit {
  id: string;
  date: ISODate;
  amountFils: Fils;
  ownerId?: string | null;
  destination: "owner_bank" | "office_bank" | "cash_to_owner";
  properties: readonly { propertyId: string; amountFils: Fils }[];
}

export interface Dataset {
  properties: readonly RProperty[];
  units: readonly RUnit[];
  contracts: readonly RContract[];
  charges: readonly Charge[];
  payments: readonly Payment[];
  allocations: readonly Allocation[];
  adjustments: readonly Adjustment[];
  legalCases: readonly RLegalCase[];
  expenseAllocations: readonly RExpenseAllocation[];
  vouchers: readonly RVoucher[];
  deposits: readonly RDeposit[];
  /** property → owner shares (percent). */
  propertyOwners?: readonly { propertyId: string; ownerId: string; sharePct: number }[];
}

// ================================================================ indexes

export class Index {
  readonly chargesByContract = new Map<string, Charge[]>();
  readonly paymentsByContract = new Map<string, Payment[]>();
  readonly allocationsByPayment = new Map<string, Allocation[]>();
  readonly allocationsByContract = new Map<string, Allocation[]>();
  readonly adjustmentsByContract = new Map<string, Adjustment[]>();
  readonly chargeById = new Map<string, Charge>();
  readonly contractsByProperty = new Map<string, RContract[]>();
  readonly unitsByProperty = new Map<string, RUnit[]>();
  readonly unitById = new Map<string, RUnit>();
  readonly propertyById = new Map<string, RProperty>();
  readonly legalByContract = new Map<string, RLegalCase>();

  constructor(readonly ds: Dataset) {
    const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
      const arr = m.get(k);
      if (arr) arr.push(v);
      else m.set(k, [v]);
    };
    for (const c of ds.charges) {
      push(this.chargesByContract, c.contractId, c);
      this.chargeById.set(c.id, c);
    }
    const paymentById = new Map<string, Payment>();
    for (const p of ds.payments) {
      if (p.voided) continue;
      push(this.paymentsByContract, p.contractId, p);
      paymentById.set(p.id, p);
    }
    for (const a of ds.allocations) {
      const p = paymentById.get(a.paymentId);
      if (!p) continue;
      push(this.allocationsByPayment, a.paymentId, a);
      push(this.allocationsByContract, p.contractId, a);
    }
    for (const a of ds.adjustments) push(this.adjustmentsByContract, a.contractId, a);
    for (const c of ds.contracts) push(this.contractsByProperty, c.propertyId, c);
    for (const u of ds.units) {
      push(this.unitsByProperty, u.propertyId, u);
      this.unitById.set(u.id, u);
    }
    for (const u of this.unitsByProperty.values()) u.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const p of ds.properties) this.propertyById.set(p.id, p);
    for (const l of ds.legalCases) {
      if (l.contractId && l.status !== "closed" && l.status !== "none")
        this.legalByContract.set(l.contractId, l);
    }
  }

  ledger(contractId: string): LedgerInput {
    return {
      charges: this.chargesByContract.get(contractId) ?? [],
      payments: this.paymentsByContract.get(contractId) ?? [],
      allocations: this.allocationsByContract.get(contractId) ?? [],
      adjustments: this.adjustmentsByContract.get(contractId) ?? [],
    };
  }

  legalStatus(contractId: string): LegalStatus {
    return this.legalByContract.get(contractId)?.status ?? "none";
  }
}

function sumBy<T>(items: readonly T[], f: (t: T) => number): number {
  let s = 0;
  for (const i of items) s += f(i);
  return s;
}

function effectiveEnd(c: Pick<RContract, "endDate" | "moveOutDate">): ISODate {
  return c.moveOutDate && c.moveOutDate < c.endDate ? c.moveOutDate : c.endDate;
}

function inRange(d: ISODate, from: ISODate, to: ISODate): boolean {
  return d >= from && d <= to;
}

// ================================================================ monthly statement (§6.6)

export interface StatementRow {
  contractId: string | null;
  unitIds: string[];
  unitLabels: string;
  tenantName: string | null;
  legalStatus: LegalStatus;
  legalLabel: string;
  rentFils: Fils;
  receiptNos: string[];
  collectedFils: Fils;
  previousFils: Fils;
  nextFils: Fils;
  lastPaymentDate: ISODate | null;
  arrearsFils: Fils;
  notes: string[];
  status: PeriodStatus;
  vacant: boolean;
  sortOrder: number;
}

export interface StatementTotals {
  rentFils: Fils;
  collectedFils: Fils;
  previousFils: Fils;
  nextFils: Fils;
  arrearsFils: Fils;
  vacantCount: number;
  occupiedCount: number;
}

export interface MonthlyStatement {
  propertyId: string;
  propertyName: string;
  ownerNames: string[];
  period: Period;
  fromDate: ISODate;
  toDate: ISODate;
  rows: StatementRow[];
  totals: StatementTotals;
}

/** Splits this month's receipts of a contract into current / previous / next. */
export function receiptsBreakdown(idx: Index, contractId: string, period: Period) {
  const from = periodStart(period);
  const to = periodEnd(period);
  const payments = (idx.paymentsByContract.get(contractId) ?? []).filter((p) =>
    inRange(p.receivedAt, from, to),
  );
  let previous = 0;
  let next = 0;
  let current = 0;
  for (const p of payments) {
    const allocs = idx.allocationsByPayment.get(p.id) ?? [];
    let allocated = 0;
    for (const a of allocs) {
      const ch = idx.chargeById.get(a.chargeId);
      allocated += a.amountFils;
      if (!ch || ch.period === period) current += a.amountFils;
      else if (ch.period < period) previous += a.amountFils;
      else next += a.amountFils;
    }
    next += Math.max(0, p.amountFils - allocated);
  }
  const sorted = [...payments].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return {
    payments: sorted,
    collected: sumBy(payments, (p) => p.amountFils),
    current,
    previous,
    next,
    receiptNos: sorted.map((p) => p.receiptNo).filter((r): r is string => !!r),
  };
}

export function monthlyStatement(
  ds: Dataset | Index,
  propertyId: string,
  period: Period,
): MonthlyStatement {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const property = idx.propertyById.get(propertyId);
  if (!property) throw new Error(`Unknown property ${propertyId}`);
  const units = (idx.unitsByProperty.get(propertyId) ?? []).filter((u) => u.active);
  const to = periodEnd(period);
  const contracts = (idx.contractsByProperty.get(propertyId) ?? []).filter((c) =>
    coversPeriod(c, period),
  );
  const covered = new Set<string>();
  const rows: StatementRow[] = [];

  for (const c of contracts) {
    const cUnits = c.unitIds.map((id) => idx.unitById.get(id)).filter((u): u is RUnit => !!u);
    cUnits.forEach((u) => covered.add(u.id));
    const ledger = idx.ledger(c.id);
    const periodCharges = ledger.charges.filter((ch) => !ch.voided && ch.period === period);
    const rent = sumBy(periodCharges, (ch) => ch.amountFils);
    const r = receiptsBreakdown(idx, c.id, period);
    const legal = idx.legalStatus(c.id);
    const notes: string[] = [];
    if (periodCharges.some((ch) => ch.kind === "free")) notes.push("free");
    for (const adj of ledger.adjustments ?? []) {
      const ch = adj.chargeId ? idx.chargeById.get(adj.chargeId) : null;
      if (ch?.period === period || (!ch && periodOf(adj.date) === period)) notes.push(adj.reason);
    }
    if (c.status === "notice_given") notes.push("notice");
    rows.push({
      contractId: c.id,
      unitIds: cUnits.map((u) => u.id),
      unitLabels: cUnits.map((u) => u.label).join(", "),
      tenantName: c.tenantName,
      legalStatus: legal,
      legalLabel: LEGAL_STATUS_LABELS_AR[legal],
      rentFils: rent,
      receiptNos: r.receiptNos,
      collectedFils: r.collected,
      previousFils: r.previous,
      nextFils: r.next,
      lastPaymentDate: lastPaymentDate(ledger.payments, to),
      arrearsFils: arrearsAsOf(ledger, to),
      notes,
      status: periodStatus(ledger, period, to, { legal: legal !== "none" }),
      vacant: false,
      sortOrder: Math.min(...cUnits.map((u) => u.sortOrder), Number.MAX_SAFE_INTEGER),
    });
  }
  for (const u of units) {
    if (covered.has(u.id)) continue;
    rows.push({
      contractId: null,
      unitIds: [u.id],
      unitLabels: u.label,
      tenantName: null,
      legalStatus: "none",
      legalLabel: LEGAL_STATUS_LABELS_AR.none,
      rentFils: 0,
      receiptNos: [],
      collectedFils: 0,
      previousFils: 0,
      nextFils: 0,
      lastPaymentDate: null,
      arrearsFils: 0,
      notes: [],
      status: "vacant",
      vacant: true,
      sortOrder: u.sortOrder,
    });
  }
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    propertyId,
    propertyName: property.name,
    ownerNames: [...property.ownerNames],
    period,
    fromDate: periodStart(period),
    toDate: to,
    rows,
    totals: {
      rentFils: sumBy(rows, (r) => r.rentFils),
      collectedFils: sumBy(rows, (r) => r.collectedFils),
      previousFils: sumBy(rows, (r) => r.previousFils),
      nextFils: sumBy(rows, (r) => r.nextFils),
      arrearsFils: sumBy(rows, (r) => r.arrearsFils),
      vacantCount: rows.filter((r) => r.vacant).length,
      occupiedCount: rows.filter((r) => !r.vacant).length,
    },
  };
}

// ================================================================ monthly cover summary (§6.8)

export interface SummaryPropertyRow {
  propertyId: string;
  propertyName: string;
  expectedFils: Fils;
  collectedFils: Fils;
  arrearsFils: Fils;
  expensesFils: Fils;
  netFils: Fils;
  depositsFils: Fils;
}

export interface MonthlySummary {
  period: Period;
  collectedFils: Fils;
  depositsFils: Fils;
  expensesFils: Fils;
  differenceFils: Fils;
  rows: SummaryPropertyRow[];
}

export function monthlySummary(
  ds: Dataset | Index,
  period: Period,
  opts: { propertyIds?: readonly string[]; ownerId?: string } = {},
): MonthlySummary {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const from = periodStart(period);
  const to = periodEnd(period);
  const props = idx.ds.properties.filter(
    (p) =>
      (!opts.propertyIds || opts.propertyIds.includes(p.id)) &&
      (!opts.ownerId || p.ownerIds.includes(opts.ownerId)),
  );
  const propIds = new Set(props.map((p) => p.id));
  const rows: SummaryPropertyRow[] = props.map((p) => {
    const contracts = idx.contractsByProperty.get(p.id) ?? [];
    let expected = 0;
    let collected = 0;
    let arrears = 0;
    for (const c of contracts) {
      const l = idx.ledger(c.id);
      expected += sumBy(
        l.charges.filter((ch) => !ch.voided && ch.period === period),
        (ch) => ch.amountFils,
      );
      collected += sumBy(
        l.payments.filter((pm) => inRange(pm.receivedAt, from, to)),
        (pm) => pm.amountFils,
      );
      arrears += arrearsAsOf(l, to);
    }
    const expenses = sumBy(
      idx.ds.expenseAllocations.filter(
        (e) => e.propertyId === p.id && inRange(e.voucherDate, from, to),
      ),
      (e) => e.amountFils,
    );
    const deposits = sumBy(
      idx.ds.deposits
        .filter((d) => inRange(d.date, from, to))
        .flatMap((d) => d.properties.filter((dp) => dp.propertyId === p.id)),
      (dp) => dp.amountFils,
    );
    return {
      propertyId: p.id,
      propertyName: p.name,
      expectedFils: expected,
      collectedFils: collected,
      arrearsFils: arrears,
      expensesFils: expenses,
      netFils: collected - expenses,
      depositsFils: deposits,
    };
  });
  const scoped = !!opts.propertyIds || !!opts.ownerId;
  const collected = sumBy(rows, (r) => r.collectedFils);
  const expenses = scoped
    ? sumBy(rows, (r) => r.expensesFils)
    : sumBy(
        idx.ds.vouchers.filter((v) => v.status === "posted" && inRange(v.date, from, to)),
        (v) => v.totalFils,
      );
  const deposits = scoped
    ? sumBy(
        idx.ds.deposits.filter(
          (d) =>
            inRange(d.date, from, to) &&
            ((opts.ownerId && d.ownerId === opts.ownerId) ||
              d.properties.some((dp) => propIds.has(dp.propertyId))),
        ),
        (d) => d.amountFils,
      )
    : sumBy(
        idx.ds.deposits.filter((d) => inRange(d.date, from, to)),
        (d) => d.amountFils,
      );
  return {
    period,
    collectedFils: collected,
    depositsFils: deposits,
    expensesFils: expenses,
    differenceFils: collected - expenses - deposits,
    rows,
  };
}

// ================================================================ late units

export interface LateRow {
  contractId: string;
  contractNo: string;
  propertyId: string;
  propertyName: string;
  unitLabels: string;
  tenantId: string;
  tenantName: string;
  phones: string[];
  monthsOverdue: number;
  amountFils: Fils;
  oldestDueDate: ISODate;
  daysLate: number;
  bucket: "d0_30" | "d31_60" | "d61_90" | "d90_plus";
  lastPaymentDate: ISODate | null;
  legalStatus: LegalStatus;
}

export function lateUnits(
  ds: Dataset | Index,
  asOf: ISODate,
  opts: { propertyIds?: readonly string[] } = {},
): LateRow[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const out: LateRow[] = [];
  for (const c of idx.ds.contracts) {
    if (c.status === "draft") continue;
    if (opts.propertyIds && !opts.propertyIds.includes(c.propertyId)) continue;
    const l = idx.ledger(c.id);
    const amount = arrearsAsOf(l, asOf);
    if (amount <= 0) continue;
    const states = [...chargeStates(l, asOf).values()]
      .filter((s) => s.charge.dueDate <= asOf && s.outstandingFils > 0)
      .sort((a, b) => a.charge.dueDate.localeCompare(b.charge.dueDate));
    const oldest = states[0]?.charge.dueDate ?? asOf;
    const days = daysLate(l, asOf);
    out.push({
      contractId: c.id,
      contractNo: c.contractNo,
      propertyId: c.propertyId,
      propertyName: idx.propertyById.get(c.propertyId)?.name ?? "",
      unitLabels: c.unitIds.map((id) => idx.unitById.get(id)?.label ?? "").join(", "),
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      phones: [...(c.tenantPhones ?? [])],
      monthsOverdue: monthsOverdue(l, asOf),
      amountFils: amount,
      oldestDueDate: oldest,
      daysLate: days,
      bucket: agingBucketOf(days),
      lastPaymentDate: lastPaymentDate(l.payments, asOf),
      legalStatus: idx.legalStatus(c.id),
    });
  }
  return out.sort(
    (a, b) => a.propertyName.localeCompare(b.propertyName) || b.amountFils - a.amountFils,
  );
}

export function lateTotals(rows: readonly LateRow[]) {
  const buckets = { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  for (const r of rows) buckets[r.bucket] += r.amountFils;
  return { count: rows.length, amountFils: sumBy(rows, (r) => r.amountFils), buckets };
}

// ================================================================ vacant units

export interface VacantRow {
  unitId: string;
  propertyId: string;
  propertyName: string;
  label: string;
  type: UnitType;
  floor: string | number | null;
  areaM2: number | null;
  askingRentFils: Fils;
  vacantSince: ISODate | null;
  daysVacant: number;
  lostRentFils: Fils;
}

const AVG_MONTH_DAYS = 365.25 / 12;

export function vacantUnits(
  ds: Dataset | Index,
  asOf: ISODate,
  opts: { propertyIds?: readonly string[] } = {},
): VacantRow[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const out: VacantRow[] = [];
  for (const u of idx.ds.units) {
    if (!u.active) continue;
    if (opts.propertyIds && !opts.propertyIds.includes(u.propertyId)) continue;
    const contracts = idx.ds.contracts.filter(
      (c) => c.unitIds.includes(u.id) && c.status !== "draft",
    );
    const occupied = contracts.some(
      (c) => isLive(c.status) && c.startDate <= asOf && asOf <= effectiveEnd(c),
    );
    if (occupied) continue;
    const past = contracts
      .filter((c) => c.startDate <= asOf)
      .map((c) => effectiveEnd(c))
      .filter((e) => e < asOf);
    const lastEnd = past.sort().at(-1);
    const since = lastEnd ? addDays(lastEnd, 1) : (u.availableFrom ?? null);
    const days = since ? Math.max(0, diffDays(since, asOf)) : 0;
    out.push({
      unitId: u.id,
      propertyId: u.propertyId,
      propertyName: idx.propertyById.get(u.propertyId)?.name ?? "",
      label: u.label,
      type: u.type,
      floor: u.floor ?? null,
      areaM2: u.areaM2 ?? null,
      askingRentFils: u.askingRentFils,
      vacantSince: since,
      daysVacant: days,
      lostRentFils: mulRound(u.askingRentFils, days / AVG_MONTH_DAYS),
    });
  }
  return out.sort(
    (a, b) => a.propertyName.localeCompare(b.propertyName) || b.daysVacant - a.daysVacant,
  );
}

// ================================================================ accounting report

export interface AccountingMonth {
  period: Period;
  expectedFils: Fils;
  collectedFils: Fils;
  arrearsFils: Fils;
  expensesFils: Fils;
  occupancyRate: number;
}

export interface AccountingReport {
  from: Period;
  to: Period;
  grossPotentialFils: Fils;
  vacancyLossFils: Fils;
  concessionsFils: Fils;
  freeMonthsFils: Fils;
  discountsFils: Fils;
  expectedFils: Fils;
  collectedFils: Fils;
  collectedCurrentFils: Fils;
  collectedArrearsFils: Fils;
  collectedAdvanceFils: Fils;
  openingArrearsFils: Fils;
  closingArrearsFils: Fils;
  expensesFils: Fils;
  expensesByCategory: { categoryId: string; categoryName: string; amountFils: Fils }[];
  commissionFils: Fils;
  noiFils: Fils;
  depositsFils: Fils;
  occupancyRate: number;
  collectionRate: number;
  avgDaysLate: number;
  moveIns: number;
  moveOuts: number;
  months: AccountingMonth[];
}

/** Rent value attributable to a unit for a period: contract share, else asking rent. */
function unitRentShares(idx: Index, c: RContract, total: Fils): Map<string, Fils> {
  const m = new Map<string, Fils>();
  if (c.unitShares && c.unitShares.length === c.unitIds.length) {
    const parts = splitByWeights(
      total,
      c.unitShares.map((s) => Math.max(0, s)),
    );
    c.unitIds.forEach((id, i) => m.set(id, parts[i]!));
  } else {
    const parts = splitEven(total, Math.max(1, c.unitIds.length));
    c.unitIds.forEach((id, i) => m.set(id, parts[i]!));
  }
  void idx;
  return m;
}

function occupiedDays(
  unitId: string,
  contracts: readonly RContract[],
  from: ISODate,
  to: ISODate,
): number {
  let days = 0;
  for (const c of contracts) {
    if (c.status === "draft" || !c.unitIds.includes(unitId)) continue;
    const s = maxDate(c.startDate, from);
    const e = minDate(effectiveEnd(c), to);
    if (s <= e) days += diffDays(s, e) + 1;
  }
  return days;
}

export function accountingReport(
  ds: Dataset | Index,
  from: Period,
  to: Period,
  opts: { propertyIds?: readonly string[]; withComparison?: boolean; asOf?: ISODate } = {},
): AccountingReport & { previous?: AccountingReport } {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const propIds = new Set(opts.propertyIds ?? idx.ds.properties.map((p) => p.id));
  const fromD = periodStart(from);
  const toD = periodEnd(to);
  /** Arrears/collection-rate never look past "today" (future months have nothing overdue yet). */
  const cap = (d: ISODate) => (opts.asOf && d > opts.asOf ? opts.asOf : d);
  const periods = periodRange(from, to);
  const contracts = idx.ds.contracts.filter(
    (c) => propIds.has(c.propertyId) && c.status !== "draft",
  );
  let expectedDue = 0;
  const units = idx.ds.units.filter((u) => propIds.has(u.propertyId) && u.active);

  let gross = 0;
  let vacancyLoss = 0;
  let freeMonths = 0;
  let expected = 0;
  let collected = 0;
  let collCurrent = 0;
  let collArrears = 0;
  let collAdvance = 0;
  const months: AccountingMonth[] = [];

  for (const period of periods) {
    const pS = periodStart(period);
    const pE = periodEnd(period);
    let mExpected = 0;
    let mCollected = 0;
    let mArrears = 0;
    const occupiedUnits = new Set<string>();
    for (const c of contracts) {
      const l = idx.ledger(c.id);
      const pCharges = l.charges.filter((ch) => !ch.voided && ch.period === period);
      const rentCh = pCharges.filter((ch) => ch.kind === "rent" || ch.kind === "free");
      if (coversPeriod(c, period)) {
        const value = sumBy(rentCh, (ch) => ch.amountFils + ch.waivedValueFils);
        const shares = unitRentShares(idx, c, value);
        for (const [uid, v] of shares) {
          occupiedUnits.add(uid);
          gross += v;
        }
      }
      freeMonths += sumBy(
        pCharges.filter((ch) => ch.kind === "free"),
        (ch) => ch.waivedValueFils,
      );
      mExpected += sumBy(pCharges, (ch) => ch.amountFils);
      for (const pm of l.payments.filter((p) => inRange(p.receivedAt, pS, pE))) {
        mCollected += pm.amountFils;
        let allocated = 0;
        for (const a of idx.allocationsByPayment.get(pm.id) ?? []) {
          const ch = idx.chargeById.get(a.chargeId);
          allocated += a.amountFils;
          if (!ch || ch.period === period) collCurrent += a.amountFils;
          else if (ch.period < period) collArrears += a.amountFils;
          else collAdvance += a.amountFils;
        }
        collAdvance += Math.max(0, pm.amountFils - allocated);
      }
      mArrears += arrearsAsOf(l, cap(pE));
      expectedDue += sumBy(
        pCharges.filter((ch) => ch.dueDate <= cap(pE)),
        (ch) => ch.amountFils,
      );
    }
    for (const u of units) {
      if (occupiedUnits.has(u.id)) continue;
      if (u.availableFrom && u.availableFrom > pE) continue;
      gross += u.askingRentFils;
      vacancyLoss += u.askingRentFils;
    }
    const mExpenses = sumBy(
      idx.ds.expenseAllocations.filter(
        (e) => propIds.has(e.propertyId) && inRange(e.voucherDate, pS, pE),
      ),
      (e) => e.amountFils,
    );
    const avail =
      units.filter((u) => !u.availableFrom || u.availableFrom <= pE).length *
      (diffDays(pS, pE) + 1);
    const occ = sumBy(units, (u) => occupiedDays(u.id, contracts, pS, pE));
    expected += mExpected;
    collected += mCollected;
    months.push({
      period,
      expectedFils: mExpected,
      collectedFils: mCollected,
      arrearsFils: mArrears,
      expensesFils: mExpenses,
      occupancyRate: avail > 0 ? occ / avail : 0,
    });
  }

  const discounts = sumBy(
    idx.ds.adjustments.filter(
      (a) =>
        (a.kind === "discount" || a.kind === "write_off") &&
        inRange(a.date, fromD, toD) &&
        contracts.some((c) => c.id === a.contractId),
    ),
    (a) => a.amountFils,
  );
  const opening = sumBy(contracts, (c) => arrearsAsOf(idx.ledger(c.id), addDays(fromD, -1)));
  const closing = sumBy(contracts, (c) => arrearsAsOf(idx.ledger(c.id), cap(toD)));
  const expAllocs = idx.ds.expenseAllocations.filter(
    (e) => propIds.has(e.propertyId) && inRange(e.voucherDate, fromD, toD),
  );
  const byCat = new Map<string, { categoryId: string; categoryName: string; amountFils: Fils }>();
  for (const e of expAllocs) {
    const cur = byCat.get(e.categoryId) ?? {
      categoryId: e.categoryId,
      categoryName: e.categoryName,
      amountFils: 0,
    };
    cur.amountFils += e.amountFils;
    byCat.set(e.categoryId, cur);
  }
  const expenses = sumBy(expAllocs, (e) => e.amountFils);

  let commission = 0;
  for (const pid of propIds) {
    const p = idx.propertyById.get(pid);
    if (!p?.commission) continue;
    if (p.commission.kind === "percent") {
      const coll = sumBy(
        contracts
          .filter((c) => c.propertyId === pid)
          .flatMap((c) =>
            (idx.paymentsByContract.get(c.id) ?? []).filter((pm) =>
              inRange(pm.receivedAt, fromD, toD),
            ),
          ),
        (pm) => pm.amountFils,
      );
      commission += mulRound(coll, p.commission.value / 100);
    } else {
      commission += Math.round(p.commission.value) * periods.length;
    }
  }

  const deposits = sumBy(
    idx.ds.deposits
      .filter((d) => inRange(d.date, fromD, toD))
      .flatMap((d) => d.properties.filter((dp) => propIds.has(dp.propertyId))),
    (dp) => dp.amountFils,
  );

  // Average days late: for rent charges due in range, days from due date to the payment that settled it (or to range end).
  const lateness: number[] = [];
  for (const c of contracts) {
    const l = idx.ledger(c.id);
    const states = chargeStates(l, toD);
    for (const s of states.values()) {
      const ch = s.charge;
      if (ch.amountFils <= 0 || !inRange(ch.dueDate, fromD, toD)) continue;
      const settledAt = s.outstandingFils === 0 ? s.paymentDates.sort().at(-1) : toD;
      lateness.push(Math.max(0, diffDays(ch.dueDate, settledAt ?? toD)));
    }
  }

  const availDays = sumBy(units, (u) => {
    const s = u.availableFrom && u.availableFrom > fromD ? u.availableFrom : fromD;
    return s <= toD ? diffDays(s, toD) + 1 : 0;
  });
  const occDays = sumBy(units, (u) => occupiedDays(u.id, contracts, fromD, toD));
  const moveIns = contracts.filter(
    (c) => inRange(c.startDate, fromD, toD) && !isRenewalStart(c, contracts),
  ).length;
  const moveOuts = contracts.filter(
    (c) =>
      (c.status === "ended" || c.status === "terminated") && inRange(effectiveEnd(c), fromD, toD),
  ).length;

  const report: AccountingReport & { previous?: AccountingReport } = {
    from,
    to,
    grossPotentialFils: gross,
    vacancyLossFils: vacancyLoss,
    concessionsFils: freeMonths + discounts,
    freeMonthsFils: freeMonths,
    discountsFils: discounts,
    expectedFils: expected,
    collectedFils: collected,
    collectedCurrentFils: collCurrent,
    collectedArrearsFils: collArrears,
    collectedAdvanceFils: collAdvance,
    openingArrearsFils: opening,
    closingArrearsFils: closing,
    expensesFils: expenses,
    expensesByCategory: [...byCat.values()].sort((a, b) => b.amountFils - a.amountFils),
    commissionFils: commission,
    noiFils: collected - expenses - commission,
    depositsFils: deposits,
    occupancyRate: availDays > 0 ? occDays / availDays : 0,
    collectionRate: expectedDue > 0 ? Math.min(1, collected / expectedDue) : 0,
    avgDaysLate: lateness.length ? lateness.reduce((a, b) => a + b, 0) / lateness.length : 0,
    moveIns,
    moveOuts,
    months,
  };
  if (opts.withComparison) {
    const prev = previousRange(from, to);
    report.previous = accountingReport(idx, prev.from, prev.to, {
      propertyIds: opts.propertyIds,
      asOf: opts.asOf,
    });
  }
  return report;
}

function isRenewalStart(c: RContract, all: readonly RContract[]): boolean {
  return all.some(
    (o) =>
      o.id !== c.id &&
      o.status === "renewed" &&
      o.tenantId === c.tenantId &&
      addDays(o.endDate, 1) === c.startDate,
  );
}

/** Δ and % between two values (null % when the base is 0). */
export function delta(current: number, previous: number): { delta: number; pct: number | null } {
  return {
    delta: current - previous,
    pct: previous !== 0 ? (current - previous) / Math.abs(previous) : null,
  };
}

// ================================================================ owner statement

export interface OwnerStatement {
  ownerId: string;
  from: Period;
  to: Period;
  rows: {
    propertyId: string;
    propertyName: string;
    sharePct: number;
    collectedFils: Fils;
    expensesFils: Fils;
    commissionFils: Fils;
    netFils: Fils;
  }[];
  collectedFils: Fils;
  expensesFils: Fils;
  commissionFils: Fils;
  netPayableFils: Fils;
  depositsFils: Fils;
  balanceFils: Fils;
}

export function ownerStatement(
  ds: Dataset | Index,
  ownerId: string,
  from: Period,
  to: Period,
): OwnerStatement {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const fromD = periodStart(from);
  const toD = periodEnd(to);
  const shares = (idx.ds.propertyOwners ?? []).filter((po) => po.ownerId === ownerId);
  const propShares =
    shares.length > 0
      ? shares.map((s) => ({ propertyId: s.propertyId, pct: s.sharePct }))
      : idx.ds.properties
          .filter((p) => p.ownerIds.includes(ownerId))
          .map((p) => ({ propertyId: p.id, pct: 100 }));
  const rows = propShares.map(({ propertyId, pct }) => {
    const r = accountingReport(idx, from, to, { propertyIds: [propertyId] });
    const ratio = pct / 100;
    const collectedFils = mulRound(r.collectedFils, ratio);
    const expensesFils = mulRound(r.expensesFils, ratio);
    const commissionFils = mulRound(r.commissionFils, ratio);
    return {
      propertyId,
      propertyName: idx.propertyById.get(propertyId)?.name ?? "",
      sharePct: pct,
      collectedFils,
      expensesFils,
      commissionFils,
      netFils: collectedFils - expensesFils - commissionFils,
    };
  });
  // Deposits split across properties count by the owner's share of each covered property;
  // unsplit deposits count only when tagged with this owner.
  const shareOf = new Map(propShares.map((x) => [x.propertyId, x.pct / 100]));
  const deposits = sumBy(
    idx.ds.deposits.filter((d) => inRange(d.date, fromD, toD)),
    (d) =>
      d.properties.length > 0
        ? sumBy(d.properties, (x) =>
            shareOf.has(x.propertyId) ? mulRound(x.amountFils, shareOf.get(x.propertyId)!) : 0,
          )
        : d.ownerId === ownerId
          ? d.amountFils
          : 0,
  );
  const net = sumBy(rows, (r) => r.netFils);
  return {
    ownerId,
    from,
    to,
    rows,
    collectedFils: sumBy(rows, (r) => r.collectedFils),
    expensesFils: sumBy(rows, (r) => r.expensesFils),
    commissionFils: sumBy(rows, (r) => r.commissionFils),
    netPayableFils: net,
    depositsFils: deposits,
    balanceFils: net - deposits,
  };
}

// ================================================================ expiring & grace

export interface ExpiringRow {
  contractId: string;
  contractNo: string;
  propertyName: string;
  unitLabels: string;
  tenantName: string;
  endDate: ISODate;
  daysLeft: number;
  autoRenew: boolean;
  noticeDate: ISODate | null;
  status: ContractStatus;
}

export function expiringContracts(
  ds: Dataset | Index,
  asOf: ISODate,
  withinDays: number,
): ExpiringRow[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const limit = addDays(asOf, withinDays);
  return idx.ds.contracts
    .filter((c) => isLive(c.status) && effectiveEnd(c) >= asOf && effectiveEnd(c) <= limit)
    .map((c) => ({
      contractId: c.id,
      contractNo: c.contractNo,
      propertyName: idx.propertyById.get(c.propertyId)?.name ?? "",
      unitLabels: c.unitIds.map((id) => idx.unitById.get(id)?.label ?? "").join(", "),
      tenantName: c.tenantName,
      endDate: effectiveEnd(c),
      daysLeft: diffDays(asOf, effectiveEnd(c)),
      autoRenew: !!c.autoRenew,
      noticeDate: c.noticeDate ?? null,
      status: c.status,
    }))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}

export interface GraceRow {
  contractId: string;
  contractNo: string;
  propertyName: string;
  unitLabels: string;
  tenantName: string;
  startDate: ISODate;
  firstCollectionDate: ISODate;
  daysUntil: number;
  monthlyRentFils: Fils;
}

export function upcomingFirstCollections(
  ds: Dataset | Index,
  asOf: ISODate,
  withinDays = 60,
): GraceRow[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const limit = addDays(asOf, withinDays);
  return idx.ds.contracts
    .filter(
      (c) => isLive(c.status) && c.firstCollectionDate > asOf && c.firstCollectionDate <= limit,
    )
    .map((c) => ({
      contractId: c.id,
      contractNo: c.contractNo,
      propertyName: idx.propertyById.get(c.propertyId)?.name ?? "",
      unitLabels: c.unitIds.map((id) => idx.unitById.get(id)?.label ?? "").join(", "),
      tenantName: c.tenantName,
      startDate: c.startDate,
      firstCollectionDate: c.firstCollectionDate,
      daysUntil: diffDays(asOf, c.firstCollectionDate),
      monthlyRentFils: c.monthlyRentFils,
    }))
    .sort((a, b) => a.firstCollectionDate.localeCompare(b.firstCollectionDate));
}

// ================================================================ expenses report

export type ExpenseGroupBy = "category" | "property" | "beneficiary" | "period";

export function expenseReport(
  ds: Dataset | Index,
  from: Period,
  to: Period,
  groupBy: ExpenseGroupBy,
  opts: { propertyIds?: readonly string[] } = {},
): { key: string; label: string; amountFils: Fils; count: number }[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const fromD = periodStart(from);
  const toD = periodEnd(to);
  const rows = idx.ds.expenseAllocations.filter(
    (e) =>
      inRange(e.voucherDate, fromD, toD) &&
      (!opts.propertyIds || opts.propertyIds.includes(e.propertyId)),
  );
  const m = new Map<string, { key: string; label: string; amountFils: Fils; count: number }>();
  for (const e of rows) {
    const [key, label] =
      groupBy === "category"
        ? [e.categoryId, e.categoryName]
        : groupBy === "property"
          ? [e.propertyId, idx.propertyById.get(e.propertyId)?.name ?? ""]
          : groupBy === "beneficiary"
            ? [e.beneficiaryId ?? "-", e.beneficiaryName ?? "—"]
            : [periodOf(e.voucherDate), periodOf(e.voucherDate)];
    const cur = m.get(key) ?? { key, label, amountFils: 0, count: 0 };
    cur.amountFils += e.amountFils;
    cur.count += 1;
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) =>
    groupBy === "period" ? a.key.localeCompare(b.key) : b.amountFils - a.amountFils,
  );
}

// ================================================================ dashboard helpers

export interface HeatmapRow {
  unitId: string;
  propertyId: string;
  propertyName: string;
  label: string;
  cells: {
    period: Period;
    status: PeriodStatus;
    amountFils: Fils;
    paidFils: Fils;
    receiptNos: string[];
  }[];
}

/** Rows = units (grouped by property), columns = periods, cells = status. */
export function paymentHeatmap(
  ds: Dataset | Index,
  periods: readonly Period[],
  asOf: ISODate,
): HeatmapRow[] {
  const idx = ds instanceof Index ? ds : new Index(ds);
  const rows: HeatmapRow[] = [];
  for (const p of idx.ds.properties) {
    for (const u of idx.unitsByProperty.get(p.id) ?? []) {
      if (!u.active) continue;
      const cells = periods.map((period) => {
        const c = (idx.contractsByProperty.get(p.id) ?? []).find(
          (k) => k.unitIds.includes(u.id) && coversPeriod(k, period),
        );
        if (!c)
          return {
            period,
            status: "vacant" as PeriodStatus,
            amountFils: 0,
            paidFils: 0,
            receiptNos: [],
          };
        const l = idx.ledger(c.id);
        const at = periodEnd(period) < asOf ? periodEnd(period) : asOf;
        const pCharges = l.charges.filter((ch) => !ch.voided && ch.period === period);
        const states = chargeStates(l, at);
        const amount = sumBy(pCharges, (ch) => ch.amountFils);
        const paid = sumBy(pCharges, (ch) => states.get(ch.id)?.allocatedFils ?? 0);
        const r = receiptsBreakdown(idx, c.id, period);
        return {
          period,
          status: periodStatus(l, period, at, { legal: idx.legalStatus(c.id) !== "none" }),
          amountFils: amount,
          paidFils: paid,
          receiptNos: r.receiptNos,
        };
      });
      rows.push({ unitId: u.id, propertyId: p.id, propertyName: p.name, label: u.label, cells });
    }
  }
  return rows;
}

/** Occupancy snapshot for a date: occupied / vacant / grace unit counts. */
export function occupancySnapshot(
  ds: Dataset | Index,
  asOf: ISODate,
  opts: { propertyIds?: readonly string[] } = {},
) {
  const idx = ds instanceof Index ? ds : new Index(ds);
  let occupied = 0;
  let grace = 0;
  let vacant = 0;
  for (const u of idx.ds.units) {
    if (!u.active) continue;
    if (opts.propertyIds && !opts.propertyIds.includes(u.propertyId)) continue;
    const c = idx.ds.contracts.find(
      (k) =>
        k.unitIds.includes(u.id) &&
        isLive(k.status) &&
        k.startDate <= asOf &&
        asOf <= effectiveEnd(k),
    );
    if (!c) vacant++;
    else if (asOf < c.firstCollectionDate) grace++;
    else occupied++;
  }
  const total = occupied + grace + vacant;
  return { occupied, grace, vacant, total, rate: total > 0 ? (occupied + grace) / total : 0 };
}
