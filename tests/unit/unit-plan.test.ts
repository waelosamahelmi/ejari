import { describe, expect, it } from "vitest";
import {
  FLOOR_MAX,
  FLOOR_MIN,
  MAX_PLANNED_UNITS,
  duplicateLabels,
  generatePlannedUnits,
  planIssues,
  planTotal,
  type UnitPlanRow,
} from "@/domain/unit-plan";

const row = (over: Partial<UnitPlanRow>): UnitPlanRow => ({
  floor: 1,
  count: 4,
  type: "apartment",
  prefix: "",
  startNumber: 101,
  askingRentFils: 300_000,
  bedrooms: null,
  areaM2: null,
  ...over,
});

describe("unit plan", () => {
  it("generates exactly the requested count on each explicit floor", () => {
    const rows = [
      row({ floor: 0, count: 2, type: "shop", prefix: "S", startNumber: 1 }),
      row({ floor: 1, count: 4, startNumber: 101 }),
      row({ floor: 2, count: 3, startNumber: 201 }),
      row({ floor: 3, count: 5, startNumber: 301 }),
    ];
    const units = generatePlannedUnits(rows);
    expect(units).toHaveLength(14);
    expect(units.filter((u) => u.floor === 0)).toHaveLength(2);
    expect(units.filter((u) => u.floor === 1)).toHaveLength(4);
    expect(units.filter((u) => u.floor === 2)).toHaveLength(3);
    expect(units.filter((u) => u.floor === 3)).toHaveLength(5);
    expect(planTotal(rows)).toBe(14);
  });

  it("assigns every generated unit to its row's floor without redistribution", () => {
    const units = generatePlannedUnits([row({ floor: 1, count: 3 }), row({ floor: 3, count: 5 })]);
    expect(units.filter((u) => u.floor === 1)).toHaveLength(3);
    expect(units.filter((u) => u.floor === 3)).toHaveLength(5);
  });

  it("produces deterministic labels from prefix and start number", () => {
    const units = generatePlannedUnits([
      row({ floor: 0, count: 2, type: "shop", prefix: "S", startNumber: 1 }),
      row({ floor: 1, count: 2, prefix: "A-", startNumber: 101 }),
    ]);
    expect(units.map((u) => u.label)).toEqual(["S1", "S2", "A-101", "A-102"]);
    expect(units.map((u) => u.type)).toEqual(["shop", "shop", "apartment", "apartment"]);
  });

  it("preserves ground floor 0 and basements", () => {
    const units = generatePlannedUnits([
      row({ floor: 0, count: 1, prefix: "G", startNumber: 1 }),
      row({ floor: -1, count: 1, prefix: "B", startNumber: 1 }),
    ]);
    expect(units.map((u) => u.floor)).toEqual([0, -1]);
  });

  it("detects duplicate labels within the plan and against existing labels", () => {
    const dupWithin = generatePlannedUnits([
      row({ startNumber: 1, count: 2 }),
      row({ floor: 2, startNumber: 1, count: 1 }),
    ]);
    expect(duplicateLabels(dupWithin)).toEqual(["1"]);
    expect(duplicateLabels(generatePlannedUnits([row({ startNumber: 5, count: 1 })]), ["5"])).toEqual(
      ["5"],
    );
    expect(duplicateLabels([{ label: "A1" }], [" a1 "])).toEqual(["A1"]);
    expect(duplicateLabels(generatePlannedUnits([row({ startNumber: 7, count: 1 })]), ["8"])).toEqual(
      [],
    );
  });

  it("enforces the maximum unit count", () => {
    expect(planIssues([row({ count: MAX_PLANNED_UNITS })])).toEqual([]);
    expect(planIssues([row({ count: MAX_PLANNED_UNITS + 1 })])).toContainEqual({ code: "total" });
    expect(planTotal([row({ count: MAX_PLANNED_UNITS + 1 })])).toBe(MAX_PLANNED_UNITS + 1);
  });

  it("flags empty plans, bad counts and out-of-range floors", () => {
    expect(planIssues([])).toContainEqual({ code: "empty" });
    expect(planIssues([row({ count: 0 })])).toContainEqual({ code: "count", row: 0 });
    expect(planIssues([row({ floor: FLOOR_MIN - 1 })])).toContainEqual({ code: "floor", row: 0 });
    expect(planIssues([row({ floor: FLOOR_MAX + 1 })])).toContainEqual({ code: "floor", row: 0 });
  });
});
