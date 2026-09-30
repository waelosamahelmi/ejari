import "server-only";
import { getTranslations } from "next-intl/server";
import type { SessionContext } from "@/lib/auth";
import { loadOrgData } from "@/server/queries/dataset";
import {
  accountingReport,
  delta,
  expenseReport,
  expiringContracts,
  lateTotals,
  lateUnits,
  monthlyStatement,
  monthlySummary,
  ownerStatement,
  upcomingFirstCollections,
  vacantUnits,
  type ExpenseGroupBy,
} from "@/domain/reports";
import { buildLedger } from "@/domain/ledger";
import { formatDate, formatPeriod, isValidDate, isValidPeriod, periodOf, presetRange, todayKuwait, type RangePreset } from "@/domain/dates";
import { UNIT_TYPE_LABELS_AR, UNIT_TYPE_LABELS_EN, LEGAL_STATUS_LABELS_AR, type LegalStatus } from "@/domain/types";

export const REPORT_TYPES = ["statement", "summary", "late", "vacant", "accounting", "owner", "ledger", "expiring", "expenses", "grace"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ColType = "text" | "money" | "date" | "int" | "pct" | "bool";
export interface RCol {
  key: string;
  header: string;
  type?: ColType;
  width?: number;
}
export type Cell = string | number | boolean | null;
export interface RSection {
  title?: string;
  columns: RCol[];
  rows: Record<string, Cell>[];
  totals?: Record<string, Cell>;
  /** Column key to group rows by (print/screen show group headers). */
  groupKey?: string;
}
export interface RKpi {
  label: string;
  value: number;
  type: "money" | "pct" | "int" | "days";
  delta?: { delta: number; pct: number | null } | null;
  tone?: "red" | "green" | "orange";
  /** Invert the meaning of an increase (for losses/arrears). */
  lowerIsBetter?: boolean;
}
export interface ReportSpec {
  type: ReportType;
  title: string;
  subtitle: string;
  kpis: RKpi[];
  sections: RSection[];
  chart?: { period: string; collected: number; arrears: number; occupancy: number }[];
  vacantAsking?: number[];
}

export interface ReportParams {
  preset: RangePreset | "custom";
  from: string;
  to: string;
  asOf: string;
  property: string | null;
  owner: string | null;
  tenant: string | null;
  days: 30 | 60 | 90;
  groupBy: ExpenseGroupBy;
  period: string;
  compare: boolean;
}

const PRESETS: RangePreset[] = ["this_month", "last_month", "this_quarter", "last_quarter", "h1", "h2", "this_year", "last_year"];

export function parseParams(sp: Record<string, string | undefined>, today = todayKuwait()): ReportParams {
  const preset = (PRESETS as string[]).includes(sp.preset ?? "") ? (sp.preset as RangePreset) : sp.preset === "custom" ? "custom" : "this_month";
  const range = preset === "custom" ? { from: sp.from ?? periodOf(today), to: sp.to ?? periodOf(today) } : presetRange(preset, today);
  const from = isValidPeriod(range.from) ? range.from : periodOf(today);
  const to = isValidPeriod(range.to) && range.to >= from ? range.to : from;
  const days = Number(sp.days) === 30 || Number(sp.days) === 60 ? (Number(sp.days) as 30 | 60) : 90;
  const groupBy = (["category", "property", "beneficiary", "period"] as const).includes(sp.groupBy as ExpenseGroupBy) ? (sp.groupBy as ExpenseGroupBy) : "category";
  return {
    preset,
    from,
    to,
    asOf: sp.asOf && isValidDate(sp.asOf) ? sp.asOf : today,
    property: sp.property || null,
    owner: sp.owner || null,
    tenant: sp.tenant || null,
    days,
    groupBy,
    period: sp.period && isValidPeriod(sp.period) ? sp.period : periodOf(today),
    compare: sp.compare !== "0",
  };
}

export function paramsToQuery(p: ReportParams): string {
  const q = new URLSearchParams({ preset: p.preset, from: p.from, to: p.to, asOf: p.asOf, days: String(p.days), groupBy: p.groupBy, period: p.period, compare: p.compare ? "1" : "0" });
  if (p.property) q.set("property", p.property);
  if (p.owner) q.set("owner", p.owner);
  if (p.tenant) q.set("tenant", p.tenant);
  return q.toString();
}

export async function buildReport(ctx: SessionContext, type: ReportType, p: ReportParams, locale: "ar" | "en"): Promise<ReportSpec> {
  const t = await getTranslations({ locale, namespace: "reports" });
  const tc = await getTranslations({ locale, namespace: "collections" });
  const tEnum = await getTranslations({ locale, namespace: "enums" });
  const data = await loadOrgData(ctx);
  const idx = data.idx;
  const propIds = data.ds.properties.filter((x) => (!p.property || x.id === p.property) && (!p.owner || x.ownerIds.includes(p.owner))).map((x) => x.id);
  const scope = p.property || p.owner ? { propertyIds: propIds } : {};
  const rangeLabel = p.from === p.to ? formatPeriod(p.from, locale) : `${formatPeriod(p.from, locale)} – ${formatPeriod(p.to, locale)}`;
  const legal = (s: LegalStatus) => (locale === "ar" ? LEGAL_STATUS_LABELS_AR[s] : tEnum(`legalStatus.${s}`));
  const title = t(`types.${type}.title`);
  const scopeName = [p.property ? data.properties.get(p.property)?.name : null, p.owner ? data.owners.get(p.owner)?.fullName : null].filter(Boolean).join(" · ");

  switch (type) {
    case "statement": {
      const pid = p.property ?? data.ds.properties[0]?.id;
      if (!pid) return { type, title, subtitle: "", kpis: [], sections: [] };
      const s = monthlyStatement(idx, pid, p.period);
      return {
        type,
        title,
        subtitle: `${s.propertyName} · ${formatPeriod(p.period, locale)}`,
        kpis: [
          { label: t("cols.expected"), value: s.totals.rentFils, type: "money" },
          { label: t("cols.collected"), value: s.totals.collectedFils, type: "money", tone: "green" },
          { label: t("cols.arrears"), value: s.totals.arrearsFils, type: "money", tone: s.totals.arrearsFils ? "red" : undefined },
          { label: t("kpi.vacantCount"), value: s.totals.vacantCount, type: "int" },
        ],
        sections: [
          {
            columns: [
              { key: "unit", header: tc("columns.unit") },
              { key: "tenant", header: tc("columns.tenant"), width: 28 },
              { key: "legal", header: tc("columns.legal") },
              { key: "rent", header: tc("columns.rent"), type: "money" },
              { key: "receipts", header: tc("columns.receipts") },
              { key: "collected", header: tc("columns.collected"), type: "money" },
              { key: "prev", header: `${tc("columns.prevNext")} (${tc("prev")})`, type: "money" },
              { key: "next", header: `${tc("columns.prevNext")} (${tc("next")})`, type: "money" },
              { key: "last", header: tc("columns.lastPayment"), type: "date" },
              { key: "arrears", header: tc("columns.arrears"), type: "money" },
            ],
            rows: s.rows.map((r) => ({
              unit: r.unitLabels,
              tenant: r.vacant ? tc("vacant") : r.tenantName,
              legal: r.vacant ? "" : legal(r.legalStatus),
              rent: r.vacant ? null : r.rentFils,
              receipts: r.receiptNos.join(", "),
              collected: r.vacant ? null : r.collectedFils,
              prev: r.previousFils || null,
              next: r.nextFils || null,
              last: r.lastPaymentDate,
              arrears: r.vacant ? null : r.arrearsFils,
            })),
            totals: { unit: t("kpi.total"), rent: s.totals.rentFils, collected: s.totals.collectedFils, prev: s.totals.previousFils, next: s.totals.nextFils, arrears: s.totals.arrearsFils },
          },
        ],
      };
    }
    case "summary": {
      const s = monthlySummary(idx, p.period, p.owner ? { ownerId: p.owner } : scope);
      return {
        type,
        title,
        subtitle: `${formatPeriod(p.period, locale)}${scopeName ? ` · ${scopeName}` : ""}`,
        kpis: [
          { label: t("cols.collected"), value: s.collectedFils, type: "money", tone: "green" },
          { label: t("kpi.deposits"), value: s.depositsFils, type: "money" },
          { label: t("cols.expenses"), value: s.expensesFils, type: "money" },
          { label: t("cols.balance"), value: s.differenceFils, type: "money", tone: s.differenceFils ? "orange" : "green" },
        ],
        sections: [
          {
            columns: [
              { key: "property", header: t("cols.property"), width: 26 },
              { key: "expected", header: t("cols.expected"), type: "money" },
              { key: "collected", header: t("cols.collected"), type: "money" },
              { key: "arrears", header: t("cols.arrears"), type: "money" },
              { key: "expenses", header: t("cols.expenses"), type: "money" },
              { key: "net", header: t("cols.net"), type: "money" },
              { key: "deposits", header: t("kpi.deposits"), type: "money" },
            ],
            rows: s.rows.map((r) => ({ property: r.propertyName, expected: r.expectedFils, collected: r.collectedFils, arrears: r.arrearsFils, expenses: r.expensesFils, net: r.netFils, deposits: r.depositsFils })),
            totals: {
              property: t("kpi.total"),
              expected: s.rows.reduce((a, r) => a + r.expectedFils, 0),
              collected: s.collectedFils,
              arrears: s.rows.reduce((a, r) => a + r.arrearsFils, 0),
              expenses: s.rows.reduce((a, r) => a + r.expensesFils, 0),
              net: s.rows.reduce((a, r) => a + r.netFils, 0),
              deposits: s.rows.reduce((a, r) => a + r.depositsFils, 0),
            },
          },
        ],
      };
    }
    case "late": {
      const rows = lateUnits(idx, p.asOf, scope);
      const tot = lateTotals(rows);
      return {
        type,
        title,
        subtitle: `${t("params.asOf")} ${formatDate(p.asOf)}${scopeName ? ` · ${scopeName}` : ""}`,
        kpis: [
          { label: t("kpi.lateCount"), value: tot.count, type: "int" },
          { label: t("kpi.total"), value: tot.amountFils, type: "money", tone: tot.amountFils ? "red" : undefined },
          { label: tEnum("aging.d0_30"), value: tot.buckets.d0_30, type: "money" },
          { label: tEnum("aging.d31_60"), value: tot.buckets.d31_60, type: "money" },
          { label: tEnum("aging.d61_90"), value: tot.buckets.d61_90, type: "money" },
          { label: tEnum("aging.d90_plus"), value: tot.buckets.d90_plus, type: "money", tone: tot.buckets.d90_plus ? "red" : undefined },
        ],
        sections: [
          {
            groupKey: "property",
            columns: [
              { key: "property", header: t("cols.property") },
              { key: "unit", header: t("cols.unit") },
              { key: "tenant", header: t("cols.tenant"), width: 26 },
              { key: "phones", header: t("cols.phones") },
              { key: "months", header: t("cols.months"), type: "int" },
              { key: "amount", header: t("cols.amount"), type: "money" },
              { key: "oldest", header: t("cols.oldest"), type: "date" },
              { key: "days", header: t("cols.days"), type: "int" },
              { key: "bucket", header: t("cols.bucket") },
              { key: "last", header: t("cols.lastPayment"), type: "date" },
              { key: "legal", header: t("cols.legal") },
            ],
            rows: rows.map((r) => ({
              property: r.propertyName,
              unit: r.unitLabels,
              tenant: r.tenantName,
              phones: r.phones.join(" / "),
              months: r.monthsOverdue,
              amount: r.amountFils,
              oldest: r.oldestDueDate,
              days: r.daysLate,
              bucket: tEnum(`aging.${r.bucket}`),
              last: r.lastPaymentDate,
              legal: legal(r.legalStatus),
              _contractId: r.contractId,
            })),
            totals: { property: t("kpi.total"), amount: tot.amountFils },
          },
        ],
      };
    }
    case "vacant": {
      const rows = vacantUnits(idx, p.asOf, scope);
      const typeLabel = locale === "ar" ? UNIT_TYPE_LABELS_AR : UNIT_TYPE_LABELS_EN;
      return {
        type,
        title,
        subtitle: `${t("params.asOf")} ${formatDate(p.asOf)}${scopeName ? ` · ${scopeName}` : ""}`,
        kpis: [
          { label: t("kpi.vacantCount"), value: rows.length, type: "int" },
          { label: t("kpi.lostTotal"), value: rows.reduce((a, r) => a + r.lostRentFils, 0), type: "money", tone: "red" },
        ],
        vacantAsking: rows.map((r) => r.askingRentFils),
        sections: [
          {
            groupKey: "property",
            columns: [
              { key: "property", header: t("cols.property") },
              { key: "unit", header: t("cols.unit") },
              { key: "type", header: t("cols.type") },
              { key: "floor", header: t("cols.floor") },
              { key: "area", header: t("cols.area"), type: "int" },
              { key: "asking", header: t("cols.asking"), type: "money" },
              { key: "since", header: t("cols.since"), type: "date" },
              { key: "days", header: t("cols.daysVacant"), type: "int" },
              { key: "lost", header: t("cols.lost"), type: "money" },
            ],
            rows: rows.map((r) => ({ property: r.propertyName, unit: r.label, type: typeLabel[r.type], floor: r.floor === null ? "" : String(r.floor), area: r.areaM2, asking: r.askingRentFils, since: r.vacantSince, days: r.daysVacant, lost: r.lostRentFils, _unitId: r.unitId })),
            totals: { property: t("kpi.total"), lost: rows.reduce((a, r) => a + r.lostRentFils, 0) },
          },
        ],
      };
    }
    case "accounting": {
      const r = accountingReport(idx, p.from, p.to, { ...scope, withComparison: p.compare, asOf: todayKuwait() });
      const prev = r.previous;
      const d = (cur: number, prv: number | undefined) => (prev && prv !== undefined ? delta(cur, prv) : null);
      return {
        type,
        title,
        subtitle: `${rangeLabel}${scopeName ? ` · ${scopeName}` : ""}`,
        kpis: [
          { label: t("kpi.gross"), value: r.grossPotentialFils, type: "money", delta: d(r.grossPotentialFils, prev?.grossPotentialFils) },
          { label: t("kpi.vacancyLoss"), value: r.vacancyLossFils, type: "money", delta: d(r.vacancyLossFils, prev?.vacancyLossFils), lowerIsBetter: true },
          { label: t("kpi.concessions"), value: r.concessionsFils, type: "money", delta: d(r.concessionsFils, prev?.concessionsFils), lowerIsBetter: true },
          { label: t("kpi.expected"), value: r.expectedFils, type: "money", delta: d(r.expectedFils, prev?.expectedFils) },
          { label: t("kpi.collected"), value: r.collectedFils, type: "money", tone: "green", delta: d(r.collectedFils, prev?.collectedFils) },
          { label: t("kpi.collectedCurrent"), value: r.collectedCurrentFils, type: "money" },
          { label: t("kpi.collectedArrears"), value: r.collectedArrearsFils, type: "money" },
          { label: t("kpi.collectedAdvance"), value: r.collectedAdvanceFils, type: "money" },
          { label: t("kpi.openingArrears"), value: r.openingArrearsFils, type: "money" },
          { label: t("kpi.closingArrears"), value: r.closingArrearsFils, type: "money", tone: r.closingArrearsFils ? "red" : undefined, delta: d(r.closingArrearsFils, prev?.closingArrearsFils), lowerIsBetter: true },
          { label: t("kpi.expenses"), value: r.expensesFils, type: "money", delta: d(r.expensesFils, prev?.expensesFils), lowerIsBetter: true },
          { label: t("kpi.commission"), value: r.commissionFils, type: "money" },
          { label: t("kpi.noi"), value: r.noiFils, type: "money", tone: "green", delta: d(r.noiFils, prev?.noiFils) },
          { label: t("kpi.deposits"), value: r.depositsFils, type: "money" },
          { label: t("kpi.occupancy"), value: r.occupancyRate, type: "pct", delta: d(r.occupancyRate, prev?.occupancyRate) },
          { label: t("kpi.collectionRate"), value: r.collectionRate, type: "pct", delta: d(r.collectionRate, prev?.collectionRate) },
          { label: t("kpi.avgDaysLate"), value: Math.round(r.avgDaysLate), type: "days", delta: d(r.avgDaysLate, prev?.avgDaysLate), lowerIsBetter: true },
          { label: t("kpi.turnover"), value: r.moveIns - r.moveOuts, type: "int" },
        ],
        chart: r.months.map((m) => ({ period: m.period, collected: m.collectedFils, arrears: m.arrearsFils, occupancy: m.occupancyRate })),
        sections: [
          {
            title: t("sections.months"),
            columns: [
              { key: "period", header: t("cols.period") },
              { key: "expected", header: t("cols.expected"), type: "money" },
              { key: "collected", header: t("cols.collected"), type: "money" },
              { key: "arrears", header: t("cols.arrears"), type: "money" },
              { key: "expenses", header: t("cols.expenses"), type: "money" },
              { key: "occupancy", header: t("cols.occupancy"), type: "pct" },
            ],
            rows: r.months.map((m) => ({ period: formatPeriod(m.period, locale), expected: m.expectedFils, collected: m.collectedFils, arrears: m.arrearsFils, expenses: m.expensesFils, occupancy: m.occupancyRate })),
            totals: { period: t("kpi.total"), expected: r.expectedFils, collected: r.collectedFils, expenses: r.expensesFils },
          },
          {
            title: t("sections.byCategory"),
            columns: [
              { key: "label", header: t("cols.label"), width: 26 },
              { key: "amount", header: t("cols.amount"), type: "money" },
            ],
            rows: r.expensesByCategory.map((c) => ({ label: c.categoryName, amount: c.amountFils })),
            totals: { label: t("kpi.total"), amount: r.expensesFils },
          },
        ],
      };
    }
    case "owner": {
      const ownerId = p.owner ?? [...data.owners.keys()][0];
      if (!ownerId) return { type, title, subtitle: "", kpis: [], sections: [] };
      const s = ownerStatement(idx, ownerId, p.from, p.to);
      return {
        type,
        title,
        subtitle: `${data.owners.get(ownerId)?.fullName ?? ""} · ${rangeLabel}`,
        kpis: [
          { label: t("kpi.collected"), value: s.collectedFils, type: "money", tone: "green" },
          { label: t("kpi.expenses"), value: s.expensesFils, type: "money" },
          { label: t("kpi.commission"), value: s.commissionFils, type: "money" },
          { label: t("kpi.netPayable"), value: s.netPayableFils, type: "money" },
          { label: t("kpi.deposits"), value: s.depositsFils, type: "money" },
          { label: t("kpi.ownerBalance"), value: s.balanceFils, type: "money", tone: s.balanceFils ? "orange" : "green" },
        ],
        sections: [
          {
            columns: [
              { key: "property", header: t("cols.property"), width: 26 },
              { key: "share", header: t("cols.share"), type: "pct" },
              { key: "collected", header: t("cols.collected"), type: "money" },
              { key: "expenses", header: t("cols.expenses"), type: "money" },
              { key: "commission", header: t("cols.commission"), type: "money" },
              { key: "net", header: t("cols.net"), type: "money" },
            ],
            rows: s.rows.map((r) => ({ property: r.propertyName, share: r.sharePct / 100, collected: r.collectedFils, expenses: r.expensesFils, commission: r.commissionFils, net: r.netFils })),
            totals: { property: t("kpi.total"), collected: s.collectedFils, expenses: s.expensesFils, commission: s.commissionFils, net: s.netPayableFils },
          },
        ],
      };
    }
    case "ledger": {
      const tenantId = p.tenant;
      if (!tenantId) return { type, title, subtitle: t("params.chooseTenant"), kpis: [], sections: [] };
      const contracts = idx.ds.contracts.filter((c) => c.tenantId === tenantId);
      const tKind = await getTranslations({ locale, namespace: "enums.chargeKind" });
      const rows = contracts
        .flatMap((c) => buildLedger(idx.ledger(c.id), { until: p.asOf }).map((r) => ({ ...r, contractNo: c.contractNo })))
        .sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0;
      const out = rows.map((r) => {
        bal += r.debitFils - r.creditFils;
        const kinds = ["rent", "free", "electricity_fixed", "penalty", "maintenance_recharge", "other"];
        const desc =
          r.kind === "payment"
            ? `${t("cols.credit")} #${r.description}`
            : r.kind === "adjustment"
              ? r.description
              : `${kinds.includes(r.description) ? tKind(r.description as "rent") : r.description}${r.period ? ` ${formatPeriod(r.period, locale)}` : ""}`;
        return { date: r.date, contract: r.contractNo, description: desc, debit: r.debitFils || null, credit: r.creditFils || null, balance: bal };
      });
      return {
        type,
        title,
        subtitle: `${data.tenants.get(tenantId)?.fullName ?? ""} · ${t("params.asOf")} ${formatDate(p.asOf)}`,
        kpis: [
          { label: t("cols.debit"), value: rows.reduce((a, r) => a + r.debitFils, 0), type: "money" },
          { label: t("cols.credit"), value: rows.reduce((a, r) => a + r.creditFils, 0), type: "money", tone: "green" },
          { label: t("cols.balance"), value: bal, type: "money", tone: bal > 0 ? "red" : "green" },
        ],
        sections: [
          {
            columns: [
              { key: "date", header: t("cols.date"), type: "date" },
              { key: "contract", header: t("cols.contract") },
              { key: "description", header: t("cols.description"), width: 32 },
              { key: "debit", header: t("cols.debit"), type: "money" },
              { key: "credit", header: t("cols.credit"), type: "money" },
              { key: "balance", header: t("cols.balance"), type: "money" },
            ],
            rows: out,
          },
        ],
      };
    }
    case "expiring": {
      const rows = expiringContracts(idx, p.asOf, p.days).filter((e) => !scope.propertyIds || idx.ds.contracts.some((c) => c.id === e.contractId && scope.propertyIds!.includes(c.propertyId)));
      return {
        type,
        title,
        subtitle: `${t("params.within")} ${t("params.days", { n: p.days })}${scopeName ? ` · ${scopeName}` : ""}`,
        kpis: [
          { label: t("kpi.total"), value: rows.length, type: "int" },
          { label: t("cols.autoRenew"), value: rows.filter((r) => r.autoRenew).length, type: "int" },
          { label: t("cols.notice"), value: rows.filter((r) => r.noticeDate).length, type: "int" },
        ],
        sections: [
          {
            columns: [
              { key: "contract", header: t("cols.contract") },
              { key: "property", header: t("cols.property") },
              { key: "unit", header: t("cols.unit") },
              { key: "tenant", header: t("cols.tenant"), width: 26 },
              { key: "end", header: t("cols.endDate"), type: "date" },
              { key: "days", header: t("cols.daysLeft"), type: "int" },
              { key: "auto", header: t("cols.autoRenew"), type: "bool" },
              { key: "notice", header: t("cols.notice"), type: "date" },
            ],
            rows: rows.map((r) => ({ contract: r.contractNo, property: r.propertyName, unit: r.unitLabels, tenant: r.tenantName, end: r.endDate, days: r.daysLeft, auto: r.autoRenew, notice: r.noticeDate, _contractId: r.contractId })),
          },
        ],
      };
    }
    case "expenses": {
      const rows = expenseReport(idx, p.from, p.to, p.groupBy, scope);
      const total = rows.reduce((a, r) => a + r.amountFils, 0);
      return {
        type,
        title,
        subtitle: `${rangeLabel} · ${t(`groupBy.${p.groupBy}`)}${scopeName ? ` · ${scopeName}` : ""}`,
        kpis: [
          { label: t("kpi.total"), value: total, type: "money" },
          { label: t("cols.count"), value: rows.reduce((a, r) => a + r.count, 0), type: "int" },
        ],
        sections: [
          {
            columns: [
              { key: "label", header: t(`groupBy.${p.groupBy}`), width: 28 },
              { key: "count", header: t("cols.count"), type: "int" },
              { key: "amount", header: t("cols.amount"), type: "money" },
              { key: "share", header: t("cols.share"), type: "pct" },
            ],
            rows: rows.map((r) => ({ label: p.groupBy === "period" ? formatPeriod(r.label, locale) : r.label, count: r.count, amount: r.amountFils, share: total ? r.amountFils / total : 0 })),
            totals: { label: t("kpi.total"), amount: total },
          },
        ],
      };
    }
    case "grace": {
      const rows = upcomingFirstCollections(idx, p.asOf, 60).filter((g) => !scope.propertyIds || idx.ds.contracts.some((c) => c.id === g.contractId && scope.propertyIds!.includes(c.propertyId)));
      return {
        type,
        title,
        subtitle: `${t("params.within")} ${t("params.days", { n: 60 })}`,
        kpis: [{ label: t("kpi.total"), value: rows.length, type: "int" }],
        sections: [
          {
            columns: [
              { key: "contract", header: t("cols.contract") },
              { key: "property", header: t("cols.property") },
              { key: "unit", header: t("cols.unit") },
              { key: "tenant", header: t("cols.tenant"), width: 26 },
              { key: "start", header: t("cols.start"), type: "date" },
              { key: "first", header: t("cols.firstCollection"), type: "date" },
              { key: "until", header: t("cols.until"), type: "int" },
              { key: "rent", header: t("cols.rent"), type: "money" },
            ],
            rows: rows.map((r) => ({ contract: r.contractNo, property: r.propertyName, unit: r.unitLabels, tenant: r.tenantName, start: r.startDate, first: r.firstCollectionDate, until: r.daysUntil, rent: r.monthlyRentFils, _contractId: r.contractId })),
          },
        ],
      };
    }
  }
}

/** Options for the parameter bar. */
export async function reportOptions(ctx: SessionContext) {
  const data = await loadOrgData(ctx);
  return {
    properties: data.ds.properties.map((p) => ({ id: p.id, name: p.name })),
    owners: [...data.owners.values()].map((o) => ({ id: o.id, name: o.fullName })),
    tenants: [...data.tenants.values()].map((t) => ({ id: t.id, name: t.fullName })).sort((a, b) => a.name.localeCompare(b.name, "ar")),
  };
}
