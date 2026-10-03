import type { UnitType } from "./types";

export const MAX_PLANNED_UNITS = 300;
export const FLOOR_MIN = -5;
export const FLOOR_MAX = 200;

/** One "units per floor" row of the planner. */
export interface UnitPlanRow {
  floor: number;
  count: number;
  type: UnitType;
  prefix: string;
  startNumber: number;
  askingRentFils: number;
  bedrooms: number | null;
  areaM2: number | null;
}

/** The concrete unit that will be inserted. */
export interface PlannedUnit {
  label: string;
  type: UnitType;
  floor: number;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  askingRentFils: number;
}

export type UnitPlanIssue =
  | { code: "empty" }
  | { code: "count"; row: number }
  | { code: "floor"; row: number }
  | { code: "total" };

export function planTotal(rows: readonly UnitPlanRow[]): number {
  return rows.reduce((n, r) => n + r.count, 0);
}

/** Deterministic: row order × (prefix + startNumber + index). Never redistributes floors. */
export function generatePlannedUnits(rows: readonly UnitPlanRow[]): PlannedUnit[] {
  const units: PlannedUnit[] = [];
  for (const row of rows) {
    const prefix = row.prefix.trim();
    for (let i = 0; i < row.count; i++) {
      units.push({
        label: `${prefix}${row.startNumber + i}`,
        type: row.type,
        floor: row.floor,
        areaM2: row.areaM2,
        bedrooms: row.bedrooms,
        bathrooms: null,
        askingRentFils: row.askingRentFils,
      });
    }
  }
  return units;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Labels that collide with an earlier unit in the list or with existing units. */
export function duplicateLabels(
  units: readonly { label: string }[],
  existing: Iterable<string> = [],
): string[] {
  const seen = new Set<string>();
  for (const e of existing) seen.add(norm(e));
  const dupes: string[] = [];
  for (const u of units) {
    const label = u.label.trim();
    if (seen.has(norm(label)) && !dupes.includes(label)) dupes.push(label);
    seen.add(norm(label));
  }
  return dupes;
}

export function planIssues(rows: readonly UnitPlanRow[]): UnitPlanIssue[] {
  const issues: UnitPlanIssue[] = [];
  if (rows.length === 0 || planTotal(rows) === 0) issues.push({ code: "empty" });
  rows.forEach((r, i) => {
    if (!Number.isInteger(r.count) || r.count < 1) issues.push({ code: "count", row: i });
    if (!Number.isInteger(r.floor) || r.floor < FLOOR_MIN || r.floor > FLOOR_MAX)
      issues.push({ code: "floor", row: i });
  });
  if (planTotal(rows) > MAX_PLANNED_UNITS) issues.push({ code: "total" });
  return issues;
}
