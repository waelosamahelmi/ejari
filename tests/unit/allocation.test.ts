import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  AllocationError,
  allocateFIFO,
  allocateManual,
  allocateToPeriods,
  amountDue,
  consumeCredit,
  creditBalance,
  sortChargesFIFO,
  type OpenCharge,
} from "@/domain/allocation";

const ch = (
  id: string,
  period: string,
  outstanding: number,
  kind: OpenCharge["kind"] = "rent",
): OpenCharge => ({
  id,
  period,
  kind,
  dueDate: `${period}-01`,
  outstandingFils: outstanding,
});

const open = [
  ch("aug", "2026-08", 20000),
  ch("jul", "2026-07", 50000),
  ch("sep", "2026-09", 320000),
  ch("sep-e", "2026-09", 3750, "electricity_fixed"),
];

describe("FIFO", () => {
  it("oldest first, rent before electricity of same period", () => {
    expect(sortChargesFIFO(open).map((c) => c.id)).toEqual(["jul", "aug", "sep", "sep-e"]);
    const r = allocateFIFO(100000, open);
    expect(r.allocations).toEqual([
      { chargeId: "jul", amountFils: 50000 },
      { chargeId: "aug", amountFils: 20000 },
      { chargeId: "sep", amountFils: 30000 },
    ]);
    expect(r.creditFils).toBe(0);
  });
  it("overpayment becomes credit", () => {
    const r = allocateFIFO(400000, open);
    expect(r.creditFils).toBe(400000 - 393750);
  });
  it("skips settled charges, zero payment", () => {
    expect(allocateFIFO(10, [ch("a", "2026-01", 0), ch("b", "2026-02", 5)]).allocations).toEqual([
      { chargeId: "b", amountFils: 5 },
    ]);
    expect(allocateFIFO(0, open)).toEqual({ allocations: [], creditFils: 0 });
    expect(() => allocateFIFO(-1, open)).toThrow();
  });
  it("invariants (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e8 }),
        fc.array(fc.integer({ min: 0, max: 1e6 }), { maxLength: 20 }),
        (amount, outs) => {
          const charges = outs.map((o, i) =>
            ch(`c${i}`, `2026-${String((i % 12) + 1).padStart(2, "0")}`, o),
          );
          const r = allocateFIFO(amount, charges);
          const total = r.allocations.reduce((a, b) => a + b.amountFils, 0);
          expect(total + r.creditFils).toBe(amount);
          expect(r.creditFils).toBeGreaterThanOrEqual(0);
          for (const a of r.allocations) {
            expect(a.amountFils).toBeGreaterThan(0);
            expect(a.amountFils).toBeLessThanOrEqual(
              charges.find((c) => c.id === a.chargeId)!.outstandingFils,
            );
          }
        },
      ),
    );
  });
});

describe("manual & periods", () => {
  it("manual override", () => {
    const r = allocateManual(100000, open, [
      { chargeId: "sep", amountFils: 60000 },
      { chargeId: "sep", amountFils: 10000 },
    ]);
    expect(r).toEqual({ allocations: [{ chargeId: "sep", amountFils: 70000 }], creditFils: 30000 });
  });
  it("manual validation", () => {
    expect(() => allocateManual(10, open, [{ chargeId: "zzz", amountFils: 1 }])).toThrow(
      AllocationError,
    );
    expect(() => allocateManual(1e9, open, [{ chargeId: "aug", amountFils: 30000 }])).toThrow(
      /exceeds charge/,
    );
    expect(() => allocateManual(10, open, [{ chargeId: "aug", amountFils: 20 }])).toThrow(
      /exceed the payment/,
    );
    expect(() => allocateManual(10, open, [{ chargeId: "aug", amountFils: -1 }])).toThrow();
  });
  it("to chosen periods", () => {
    const r = allocateToPeriods(330000, open, ["2026-09"]);
    expect(r.allocations.map((a) => a.chargeId)).toEqual(["sep", "sep-e"]);
    expect(r.creditFils).toBe(330000 - 323750);
  });
  it("credit consumption and balances", () => {
    expect(consumeCredit(10000, [ch("x", "2026-10", 320000)]).allocations).toEqual([
      { chargeId: "x", amountFils: 10000 },
    ]);
    expect(creditBalance([{ amountFils: 500 }], [{ amountFils: 300 }])).toBe(200);
    expect(amountDue(open, "2026-08-31")).toBe(70000);
  });
});
