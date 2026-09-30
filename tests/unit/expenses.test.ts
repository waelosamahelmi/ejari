import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ALLOCATION_MODES,
  ExpenseAllocationError,
  allocateExpenseLine,
  totalsByProperty,
  voucherTotal,
} from "@/domain/expenses";

describe("expense allocation", () => {
  it("single", () =>
    expect(allocateExpenseLine(170000, "single", [{ propertyId: "J", unitId: "u" }])).toEqual([
      { propertyId: "J", unitId: "u", amountFils: 170000 },
    ]));
  it("split even (meter photocopy 4.750 between Jabriya and Salmiya)", () => {
    expect(
      allocateExpenseLine(4750, "split_even", [{ propertyId: "J" }, { propertyId: "S" }]).map(
        (a) => a.amountFils,
      ),
    ).toEqual([2375, 2375]);
    expect(
      allocateExpenseLine(1001, "split_even", [{ propertyId: "J" }, { propertyId: "S" }]).map(
        (a) => a.amountFils,
      ),
    ).toEqual([501, 500]);
  });
  it("by units / by rent", () => {
    expect(
      allocateExpenseLine(1000, "split_by_units", [
        { propertyId: "A", unitCount: 29 },
        { propertyId: "B", unitCount: 10 },
      ]).map((a) => a.amountFils),
    ).toEqual([744, 256]);
    expect(
      allocateExpenseLine(1000, "split_by_rent", [
        { propertyId: "A", expectedRentFils: 3 },
        { propertyId: "B", expectedRentFils: 1 },
      ]).map((a) => a.amountFils),
    ).toEqual([750, 250]);
    expect(
      allocateExpenseLine(10, "split_by_units", [{ propertyId: "A" }, { propertyId: "B" }]).map(
        (a) => a.amountFils,
      ),
    ).toEqual([5, 5]);
    expect(
      allocateExpenseLine(10, "split_by_rent", [{ propertyId: "A" }]).map((a) => a.amountFils),
    ).toEqual([10]);
  });
  it("manual percent / amount", () => {
    expect(
      allocateExpenseLine(1000, "manual_percent", [
        { propertyId: "A", percent: 33.33 },
        { propertyId: "B", percent: 66.67 },
      ]).map((a) => a.amountFils),
    ).toEqual([333, 667]);
    expect(
      allocateExpenseLine(1000, "manual_amount", [
        { propertyId: "A", amountFils: 400 },
        { propertyId: "B", amountFils: 600 },
      ]).map((a) => a.amountFils),
    ).toEqual([400, 600]);
  });
  it("errors", () => {
    expect(() => allocateExpenseLine(1, "single", [])).toThrow(ExpenseAllocationError);
    expect(() =>
      allocateExpenseLine(1, "single", [{ propertyId: "A" }, { propertyId: "B" }]),
    ).toThrow(/exactly one/);
    expect(() => allocateExpenseLine(-1, "single", [{ propertyId: "A" }])).toThrow();
    expect(() =>
      allocateExpenseLine(1, "manual_percent", [{ propertyId: "A", percent: 50 }]),
    ).toThrow(/100/);
    expect(() =>
      allocateExpenseLine(1, "manual_percent", [
        { propertyId: "A", percent: -50 },
        { propertyId: "B", percent: 150 },
      ]),
    ).toThrow();
    expect(() =>
      allocateExpenseLine(10, "manual_amount", [{ propertyId: "A", amountFils: 4 }]),
    ).toThrow(/sum/);
    expect(() =>
      allocateExpenseLine(10, "manual_amount", [
        { propertyId: "A", amountFils: -4 },
        { propertyId: "B", amountFils: 14 },
      ]),
    ).toThrow();
  });
  it("every mode sums exactly (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 1, max: 8 }),
        fc.constantFrom(...ALLOCATION_MODES),
        (amount, n, mode) => {
          const count = mode === "single" ? 1 : n;
          const targets = Array.from({ length: count }, (_, i) => ({
            propertyId: `p${i}`,
            unitCount: i + 1,
            expectedRentFils: (i + 1) * 1000,
            percent: i === 0 ? 100 : 0,
            amountFils: i === 0 ? amount : 0,
          }));
          const r = allocateExpenseLine(amount, mode, targets);
          expect(r.reduce((a, b) => a + b.amountFils, 0)).toBe(amount);
          r.forEach((a) => expect(a.amountFils).toBeGreaterThanOrEqual(0));
        },
      ),
    );
  });
  it("totals", () => {
    expect(
      voucherTotal([{ amountFils: 170000 }, { amountFils: 4750 }, { amountFils: 20250 }]),
    ).toBe(195000);
    const t = totalsByProperty([
      { propertyId: "J", unitId: null, amountFils: 1 },
      { propertyId: "J", unitId: null, amountFils: 2 },
      { propertyId: "S", unitId: null, amountFils: 3 },
    ]);
    expect(Object.fromEntries(t)).toEqual({ J: 3, S: 3 });
  });
});
