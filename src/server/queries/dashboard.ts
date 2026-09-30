import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { addPeriods, periodEnd, periodRange, periodStart, type ISODate, type Period } from "@/domain/dates";
import {
  accountingReport,
  expiringContracts,
  lateTotals,
  lateUnits,
  monthlySummary,
  occupancySnapshot,
  paymentHeatmap,
  upcomingFirstCollections,
  vacantUnits,
} from "@/domain/reports";
import type { PeriodStatus } from "@/domain/types";
import { loadOrgData } from "./dataset";
import { propertySummaries } from "./properties";
import { signPaths } from "@/server/storage";

export interface DashboardFilters {
  period: Period;
  propertyId: string | null;
  ownerId: string | null;
}

export interface DashboardData {
  period: Period;
  today: ISODate;
  collection: { expectedFils: number; collectedFils: number; prevExpectedFils: number; prevCollectedFils: number };
  arrears: { totalFils: number; count: number; buckets: { d0_30: number; d31_60: number; d61_90: number; d90_plus: number }; top: { contractId: string; tenant: string; unit: string; property: string; amountFils: number; daysLate: number }[] };
  occupancy: { occupied: number; vacant: number; grace: number; total: number; rate: number };
  vacant: { unitId: string; property: string; label: string; daysVacant: number; askingRentFils: number }[];
  cash: { collectedFils: number; expensesFils: number; depositsFils: number; differenceFils: number } | null;
  trend: { period: Period; expectedFils: number; collectedFils: number; occupancy: number }[];
  heatmap: { unitId: string; property: string; label: string; cells: { period: Period; status: PeriodStatus; amountFils: number; paidFils: number; receiptNos: string[] }[] }[];
  expiring: { contractId: string; tenant: string; unit: string; endDate: string; daysLeft: number; autoRenew: boolean; notice: boolean }[];
  notices: number;
  firstCollections: { contractId: string; tenant: string; unit: string; date: string; daysUntil: number }[];
  expenses: { totalFils: number; byCategory: { name: string; amountFils: number }[]; last: { id: string; no: string; date: string; totalFils: number }[] } | null;
  legal: { open: number; nextHearing: { caseId: string; date: string; tenant: string } | null } | null;
  todayPayments: number;
  properties: { id: string; name: string; area: string | null; cover: string | null; blur?: string; unitsCount: number; occupancyRate: number; collectedFils: number; expectedFils: number; arrearsFils: number }[];
  owners: { id: string; name: string }[];
}

export async function dashboardData(ctx: SessionContext, f: DashboardFilters, today: ISODate): Promise<DashboardData> {
  const data = await loadOrgData(ctx);
  const idx = data.idx;
  const propIds = data.ds.properties
    .filter((p) => (!f.propertyId || p.id === f.propertyId) && (!f.ownerId || p.ownerIds.includes(f.ownerId)) && data.properties.get(p.id)?.active)
    .map((p) => p.id);
  const scope = { propertyIds: propIds };
  const asOf = periodEnd(f.period) < today ? periodEnd(f.period) : today;
  const cur = monthlySummary(idx, f.period, scope);
  const prev = monthlySummary(idx, addPeriods(f.period, -1), scope);
  const late = lateUnits(idx, asOf, scope);
  const lt = lateTotals(late);
  const trendPeriods = periodRange(addPeriods(f.period, -11), f.period);
  const acc = accountingReport(idx, trendPeriods[0]!, f.period, { ...scope, asOf: today });
  const finance = can(ctx.role, "view_expenses");
  const db = await supabaseServer();

  let expenses: DashboardData["expenses"] = null;
  if (finance) {
    const allocs = idx.ds.expenseAllocations.filter((e) => propIds.includes(e.propertyId) && e.voucherDate >= periodStart(f.period) && e.voucherDate <= periodEnd(f.period));
    const byCat = new Map<string, number>();
    for (const e of allocs) byCat.set(e.categoryName, (byCat.get(e.categoryName) ?? 0) + e.amountFils);
    const voucherIds = new Set(allocs.map((a) => a.voucherId));
    expenses = {
      totalFils: allocs.reduce((a, e) => a + e.amountFils, 0),
      byCategory: [...byCat.entries()].map(([name, amountFils]) => ({ name, amountFils })).sort((a, b) => b.amountFils - a.amountFils),
      last: idx.ds.vouchers
        .filter((v) => v.status === "posted" && (voucherIds.has(v.id) || (!f.propertyId && !f.ownerId)))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
        .map((v) => ({ id: v.id, no: v.voucherNo, date: v.date, totalFils: v.totalFils })),
    };
  }

  let legal: DashboardData["legal"] = null;
  if (can(ctx.role, "view_legal")) {
    const open = idx.ds.legalCases.filter((l) => l.status !== "closed" && l.status !== "none" && (!l.contractId || propIds.includes(idx.ds.contracts.find((c) => c.id === l.contractId)?.propertyId ?? "")));
    const next = open.filter((l) => l.nextHearingDate && l.nextHearingDate >= today).sort((a, b) => a.nextHearingDate!.localeCompare(b.nextHearingDate!))[0];
    legal = { open: open.length, nextHearing: next ? { caseId: next.id, date: next.nextHearingDate!, tenant: data.tenants.get(next.tenantId)?.fullName ?? "" } : null };
  }

  const { count: todayPayments } = await db.from("payments").select("id", { count: "exact", head: true }).eq("received_at", today).eq("created_by", ctx.userId).eq("voided", false);

  const summaries = propertySummaries(data, f.period, today).filter((p) => propIds.includes(p.id));
  const signed = await signPaths("media", summaries.map((p) => p.cover));
  const expiring = expiringContracts(idx, today, 90).filter((e) => {
    const c = idx.ds.contracts.find((x) => x.id === e.contractId);
    return c && propIds.includes(c.propertyId);
  });

  return {
    period: f.period,
    today,
    collection: { expectedFils: cur.rows.reduce((a, r) => a + r.expectedFils, 0), collectedFils: cur.collectedFils, prevExpectedFils: prev.rows.reduce((a, r) => a + r.expectedFils, 0), prevCollectedFils: prev.collectedFils },
    arrears: {
      totalFils: lt.amountFils,
      count: lt.count,
      buckets: lt.buckets,
      top: [...late].sort((a, b) => b.daysLate - a.daysLate).slice(0, 3).map((r) => ({ contractId: r.contractId, tenant: r.tenantName, unit: r.unitLabels, property: r.propertyName, amountFils: r.amountFils, daysLate: r.daysLate })),
    },
    occupancy: occupancySnapshot(idx, today, scope),
    vacant: vacantUnits(idx, today, scope).slice(0, 5).map((v) => ({ unitId: v.unitId, property: v.propertyName, label: v.label, daysVacant: v.daysVacant, askingRentFils: v.askingRentFils })),
    cash: finance ? { collectedFils: cur.collectedFils, expensesFils: cur.expensesFils, depositsFils: cur.depositsFils, differenceFils: cur.differenceFils } : null,
    trend: acc.months.map((m) => ({ period: m.period, expectedFils: m.expectedFils, collectedFils: m.collectedFils, occupancy: m.occupancyRate })),
    heatmap: paymentHeatmap(idx, trendPeriods, today)
      .filter((r) => propIds.includes(r.propertyId))
      .map((r) => ({ unitId: r.unitId, property: r.propertyName, label: r.label, cells: r.cells })),
    expiring: expiring.slice(0, 5).map((e) => ({ contractId: e.contractId, tenant: e.tenantName, unit: `${e.propertyName} · ${e.unitLabels}`, endDate: e.endDate, daysLeft: e.daysLeft, autoRenew: e.autoRenew, notice: !!e.noticeDate })),
    notices: idx.ds.contracts.filter((c) => c.status === "notice_given" && propIds.includes(c.propertyId)).length,
    firstCollections: upcomingFirstCollections(idx, today, 60)
      .filter((g) => propIds.includes(idx.ds.contracts.find((c) => c.id === g.contractId)?.propertyId ?? ""))
      .slice(0, 4)
      .map((g) => ({ contractId: g.contractId, tenant: g.tenantName, unit: `${g.propertyName} · ${g.unitLabels}`, date: g.firstCollectionDate, daysUntil: g.daysUntil })),
    expenses,
    legal,
    todayPayments: todayPayments ?? 0,
    properties: summaries.map((p) => ({
      id: p.id,
      name: p.name,
      area: p.area,
      cover: p.cover ? (signed.get(p.cover) ?? null) : null,
      blur: data.properties.get(p.id)?.photos[0]?.blur,
      unitsCount: p.unitsCount,
      occupancyRate: p.occupancyRate,
      collectedFils: p.collectedFils,
      expectedFils: p.expectedFils,
      arrearsFils: p.arrearsFils,
    })),
    owners: [...data.owners.values()].map((o) => ({ id: o.id, name: o.fullName })),
  };
}
