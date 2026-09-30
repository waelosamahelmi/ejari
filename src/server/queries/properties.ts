import "server-only";
import { periodEnd, type ISODate, type Period } from "@/domain/dates";
import { deriveUnitStatus } from "@/domain/contracts";
import { arrearsAsOf, periodStatus } from "@/domain/ledger";
import { monthlySummary, occupancySnapshot, receiptsBreakdown } from "@/domain/reports";
import type { PeriodStatus, UnitStatus } from "@/domain/types";
import type { OrgData } from "./dataset";

export interface PropertySummary {
  id: string;
  name: string;
  nameEn: string | null;
  area: string | null;
  propertyType: string;
  cover: string | null;
  ownerNames: string[];
  ownerIds: string[];
  unitsCount: number;
  occupancyRate: number;
  expectedFils: number;
  collectedFils: number;
  arrearsFils: number;
  active: boolean;
}

export function propertySummaries(d: OrgData, period: Period, today: ISODate): PropertySummary[] {
  const summary = monthlySummary(d.idx, period);
  return d.ds.properties.map((p) => {
    const meta = d.properties.get(p.id)!;
    const row = summary.rows.find((r) => r.propertyId === p.id);
    const occ = occupancySnapshot(d.idx, today, { propertyIds: [p.id] });
    const arrears = (d.idx.contractsByProperty.get(p.id) ?? []).reduce((a, c) => a + arrearsAsOf(d.idx.ledger(c.id), today), 0);
    return {
      id: p.id,
      name: p.name,
      nameEn: meta.nameEn,
      area: meta.area,
      propertyType: meta.propertyType,
      cover: meta.coverImagePath,
      ownerNames: [...p.ownerNames],
      ownerIds: [...p.ownerIds],
      unitsCount: occ.total,
      occupancyRate: occ.rate,
      expectedFils: row?.expectedFils ?? 0,
      collectedFils: row?.collectedFils ?? 0,
      arrearsFils: arrears,
      active: meta.active,
    };
  });
}

export interface StackUnit {
  id: string;
  label: string;
  type: string;
  floor: number | null;
  sortOrder: number;
  status: UnitStatus;
  periodStatus: PeriodStatus;
  tenantName: string | null;
  contractId: string | null;
  rentFils: number;
  askingRentFils: number;
  underMaintenance: boolean;
}

/** Building Stack data: each active unit with derived status for today and this month's payment status. */
export function buildingStack(d: OrgData, propertyId: string, period: Period, today: ISODate): StackUnit[] {
  const units = (d.idx.unitsByProperty.get(propertyId) ?? []).filter((u) => u.active);
  const contracts = d.idx.contractsByProperty.get(propertyId) ?? [];
  return units.map((u) => {
    const cs = contracts.filter((c) => c.unitIds.includes(u.id));
    const status = deriveUnitStatus(
      today,
      cs.map((c) => ({ ...c, hasOpenLegalCase: d.idx.legalStatus(c.id) !== "none" })),
    );
    const current = cs.find((c) => (c.status === "active" || c.status === "notice_given") && c.startDate <= today && today <= (c.moveOutDate ?? c.endDate)) ?? cs.find((c) => (c.status === "active" || c.status === "notice_given") && c.startDate > today);
    const meta = d.units.get(u.id);
    const asOf = periodEnd(period) < today ? periodEnd(period) : today;
    return {
      id: u.id,
      label: u.label,
      type: u.type,
      floor: typeof u.floor === "number" ? u.floor : null,
      sortOrder: u.sortOrder,
      status,
      periodStatus: current ? periodStatus(d.idx.ledger(current.id), period, asOf, { legal: d.idx.legalStatus(current.id) !== "none" }) : "vacant",
      tenantName: current?.tenantName ?? null,
      contractId: current?.id ?? null,
      rentFils: current ? Math.round(current.monthlyRentFils / Math.max(1, current.unitIds.length)) : 0,
      askingRentFils: u.askingRentFils,
      underMaintenance: meta?.underMaintenance ?? false,
    };
  });
}

export { receiptsBreakdown };
