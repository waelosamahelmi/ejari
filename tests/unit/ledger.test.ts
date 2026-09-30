import { describe, expect, it } from "vitest";
import {
  aging, agingBucketOf, arrearsAsOf, arrearsAtPeriodEnd, balanceSummary, buildLedger, chargeStates, daysLate, lastPaymentDate,
  monthsOverdue, overdueCharges, periodStatus, type LedgerInput,
} from "@/domain/ledger";
import type { Charge } from "@/domain/types";

const charge = (period: string, amount: number, kind: Charge["kind"] = "rent", waived = 0): Charge => ({
  id: `${kind}-${period}`, contractId: "c1", period, kind, amountFils: amount, waivedValueFils: waived, dueDate: `${period}-01`,
});

const base: LedgerInput = {
  charges: [charge("2026-07", 320000), charge("2026-08", 320000), charge("2026-09", 320000)],
  payments: [
    { id: "p1", contractId: "c1", amountFils: 320000, receivedAt: "2026-07-03", receiptNo: "4411" },
    { id: "p2", contractId: "c1", amountFils: 300000, receivedAt: "2026-08-05", receiptNo: "51230" },
  ],
  allocations: [
    { paymentId: "p1", chargeId: "rent-2026-07", amountFils: 320000 },
    { paymentId: "p2", chargeId: "rent-2026-08", amountFils: 300000 },
  ],
};

describe("arrears", () => {
  it("partial payment creates arrears that carry forward", () => {
    expect(arrearsAsOf(base, "2026-08-31")).toBe(20000);
    expect(arrearsAtPeriodEnd(base, "2026-08")).toBe(20000);
    expect(arrearsAsOf(base, "2026-09-30")).toBe(340000);
  });
  it("as-of ignores later payments", () => {
    expect(arrearsAsOf(base, "2026-08-04")).toBe(320000);
  });
  it("adjustments reduce arrears (linked and unlinked), dated", () => {
    const withAdj: LedgerInput = {
      ...base,
      adjustments: [
        { id: "a1", contractId: "c1", chargeId: "rent-2026-08", kind: "discount", amountFils: 20000, date: "2026-08-20", reason: "خصم" },
        { id: "a2", contractId: "c1", chargeId: null, kind: "write_off", amountFils: 5000, date: "2026-09-10", reason: "شطب" },
        { id: "a3", contractId: "c1", chargeId: "missing", kind: "correction", amountFils: 1, date: "2026-09-10", reason: "x" },
      ],
    };
    expect(arrearsAsOf(withAdj, "2026-08-31")).toBe(0);
    expect(arrearsAsOf(withAdj, "2026-08-19")).toBe(20000);
    expect(arrearsAsOf(withAdj, "2026-09-30")).toBe(315000);
  });
  it("voided payments and charges are ignored", () => {
    const v: LedgerInput = {
      ...base,
      payments: base.payments.map((p) => (p.id === "p2" ? { ...p, voided: true } : p)),
      charges: [...base.charges, { ...charge("2026-06", 1), voided: true }],
    };
    expect(arrearsAsOf(v, "2026-08-31")).toBe(320000);
    expect(chargeStates({ ...base, allocations: [...base.allocations, { paymentId: "zz", chargeId: "x", amountFils: 1 }] }).size).toBe(3);
  });
});

describe("lateness", () => {
  it("days late / months overdue / overdue list", () => {
    expect(daysLate(base, "2026-09-30")).toBe(60);
    expect(daysLate(base, "2026-07-31")).toBe(0);
    expect(monthsOverdue(base, "2026-09-30")).toBe(2);
    expect(overdueCharges(base, "2026-09-30").map((s) => s.charge.period)).toEqual(["2026-08", "2026-09"]);
  });
  it("aging buckets", () => {
    const l: LedgerInput = { charges: [charge("2026-05", 100), charge("2026-06", 200), charge("2026-07", 300), charge("2026-09", 400)], payments: [], allocations: [] };
    expect(aging(l, "2026-09-15")).toEqual({ d0_30: 400, d31_60: 0, d61_90: 300, d90_plus: 300 });
    expect(agingBucketOf(10)).toBe("d0_30");
    expect(agingBucketOf(45)).toBe("d31_60");
    expect(agingBucketOf(75)).toBe("d61_90");
    expect(agingBucketOf(91)).toBe("d90_plus");
  });
});

describe("period statuses", () => {
  it("paid / partial / unpaid / due / legal / vacant / free / advance", () => {
    expect(periodStatus(base, "2026-07", "2026-09-30")).toBe("paid");
    expect(periodStatus(base, "2026-08", "2026-09-30")).toBe("partial");
    expect(periodStatus(base, "2026-09", "2026-09-30")).toBe("unpaid");
    expect(periodStatus(base, "2026-09", "2026-08-31")).toBe("due");
    expect(periodStatus(base, "2026-09", "2026-09-30", { legal: true })).toBe("legal");
    expect(periodStatus(base, "2026-09", "2026-09-30", { occupied: false })).toBe("vacant");
    expect(periodStatus(base, "2026-12", "2026-09-30")).toBe("vacant");
    const free: LedgerInput = { charges: [charge("2026-10", 0, "free", 650000)], payments: [], allocations: [] };
    expect(periodStatus(free, "2026-10", "2026-10-31")).toBe("free");
    const adv: LedgerInput = {
      charges: [charge("2026-10", 400000)],
      payments: [{ id: "p", contractId: "c1", amountFils: 400000, receivedAt: "2026-09-03" }],
      allocations: [{ paymentId: "p", chargeId: "rent-2026-10", amountFils: 400000 }],
    };
    expect(periodStatus(adv, "2026-10", "2026-10-15")).toBe("advance");
  });
});

describe("ledger & summaries", () => {
  it("running balance", () => {
    const rows = buildLedger({ ...base, adjustments: [{ id: "a", contractId: "c1", chargeId: null, kind: "discount", amountFils: 1000, date: "2026-08-10", reason: "r" }] });
    expect(rows.map((r) => r.balanceFils)).toEqual([320000, 0, 320000, 20000, 19000, 339000]);
    expect(buildLedger(base, { until: "2026-07-31" })).toHaveLength(2);
    const withFreeAndVoid = buildLedger({ ...base, charges: [charge("2026-06", 0, "free", 1)], payments: [{ ...base.payments[0]!, voided: true }] });
    expect(withFreeAndVoid[0]!.kind).toBe("free");
    expect(buildLedger({ ...base, adjustments: [{ id: "a", contractId: "c1", chargeId: null, kind: "discount", amountFils: 1, date: "2027-01-01", reason: "r" }] }, { until: "2026-12-31" })).toHaveLength(5);
  });
  it("balance summary with credit", () => {
    const l: LedgerInput = { ...base, payments: [...base.payments, { id: "p3", contractId: "c1", amountFils: 500000, receivedAt: "2026-09-02" }], allocations: [...base.allocations, { paymentId: "p3", chargeId: "rent-2026-08", amountFils: 20000 }, { paymentId: "p3", chargeId: "rent-2026-09", amountFils: 320000 }] };
    const s = balanceSummary(l, "2026-09-30");
    expect(s).toMatchObject({ arrearsFils: 0, creditFils: 160000, net: -160000 });
  });
  it("last payment date", () => {
    expect(lastPaymentDate(base.payments)).toBe("2026-08-05");
    expect(lastPaymentDate(base.payments, "2026-07-31")).toBe("2026-07-03");
    expect(lastPaymentDate([{ ...base.payments[0]!, voided: true }])).toBeNull();
  });
});
