import { describe, expect, it } from "vitest";
import * as c from "@/domain/contracts";

describe("defaults & numbering", () => {
  it("defaults per type", () => {
    expect(c.contractDefaults("residential")).toEqual({
      termMonths: 60,
      autoRenew: false,
      noticePeriodMonths: 2,
      freeMonthsPenaltyWindowMonths: 12,
    });
    expect(c.contractDefaults("investment")).toMatchObject({
      autoRenew: true,
      noticePeriodMonths: 1,
    });
    expect(c.PURPOSE_PRESETS.investment).toContain("مكتب عقاري");
  });
  it("numbers", () => {
    expect(c.formatContractNo("residential", 2026, 1)).toBe("R-2026-0001");
    expect(c.formatContractNo("investment", 2026, 12)).toBe("I-2026-0012");
    expect(c.formatSequenceNo("RC", 2026, 1)).toBe("RC-2026-00001");
  });
});

describe("lifecycle", () => {
  it("transitions", () => {
    expect(c.canPerform("draft", "activate")).toBe(true);
    expect(c.canPerform("draft", "terminate")).toBe(false);
    expect(c.canPerform("active", "record_notice")).toBe(true);
    expect(c.canPerform("notice_given", "record_notice")).toBe(false);
    expect(c.allowedActions("ended")).toEqual([]);
    expect(c.isLive("notice_given")).toBe(true);
    expect(c.isLive("renewed")).toBe(false);
  });
  it("validate terms", () => {
    const ok = {
      type: "investment" as const,
      contractDate: "2026-10-01",
      startDate: "2026-10-01",
      firstCollectionDate: "2026-12-01",
      termMonths: 60,
      monthlyRentFils: 650000,
      freeMonths: 2,
    };
    expect(c.validateTerms(ok)).toEqual([]);
    expect(
      c.validateTerms({
        ...ok,
        firstCollectionDate: "2026-09-01",
        contractDate: "2026-11-01",
        monthlyRentFils: 0,
        termMonths: 0,
      }),
    ).toEqual([
      "first_collection_before_start",
      "contract_after_start",
      "zero_rent",
      "invalid_term",
      "free_months_mismatch",
    ]);
    expect(c.firstCollectionFor("2026-10-01", 2)).toBe("2026-12-01");
    expect(c.firstCollectionFor("2026-10-01", -1)).toBe("2026-10-01");
  });
});

describe("notice, renewal, overlap", () => {
  it("expected move out", () => expect(c.expectedMoveOut("2026-09-15", 2)).toBe("2026-11-15"));
  it("renewal", () => {
    expect(
      c.renewalTerms({ endDate: "2026-11-14", termMonths: 12, monthlyRentFils: 700000 }),
    ).toEqual({
      startDate: "2026-11-15",
      firstCollectionDate: "2026-11-15",
      termMonths: 12,
      endDate: "2027-11-14",
      monthlyRentFils: 700000,
    });
    expect(
      c.renewalTerms({
        endDate: "2026-11-14",
        termMonths: 12,
        renewalTermMonths: 24,
        monthlyRentFils: 1,
        newRentFils: 2,
      }),
    ).toMatchObject({ termMonths: 24, monthlyRentFils: 2, endDate: "2028-11-14" });
  });
  it("overlap", () => {
    expect(
      c.rangesOverlap(
        { start: "2026-01-01", end: "2026-12-31" },
        { start: "2026-12-31", end: "2027-12-31" },
      ),
    ).toBe(true);
    expect(
      c.rangesOverlap(
        { start: "2026-01-01", end: "2026-12-31" },
        { start: "2027-01-01", end: "2027-12-31" },
      ),
    ).toBe(false);
  });
  it("contractEndDate re-export", () =>
    expect(c.contractEndDate("2026-10-01", 60)).toBe("2031-09-30"));
});

describe("termination", () => {
  const inv = {
    type: "investment" as const,
    startDate: "2026-10-01",
    freeMonths: 2,
    freeMonthsPenaltyWindowMonths: 12,
    monthlyRentFils: 650000,
  };
  it("early exit penalty = free months value within 12 months", () => {
    expect(c.earlyExitPenalty(inv, "2027-05-31")).toBe(1300000);
    expect(c.earlyExitPenalty(inv, "2027-10-01")).toBe(0);
    expect(c.earlyExitPenalty({ ...inv, freeMonths: 0 }, "2027-01-01")).toBe(0);
    expect(c.earlyExitPenalty({ ...inv, type: "residential" }, "2027-01-01")).toBe(0);
  });
  it("deposit settlement never negative", () => {
    expect(
      c.terminationSettlement({ arrearsFils: 100, penaltyFils: 0, securityDepositFils: 600 }),
    ).toEqual({
      depositAppliedFils: 100,
      refundFils: 500,
      remainingDueFils: 0,
      depositStatus: "forfeited_partially",
    });
    expect(
      c.terminationSettlement({ arrearsFils: 700, penaltyFils: 300, securityDepositFils: 600 }),
    ).toEqual({
      depositAppliedFils: 600,
      refundFils: 0,
      remainingDueFils: 400,
      depositStatus: "forfeited",
    });
    expect(
      c.terminationSettlement({ arrearsFils: 0, penaltyFils: 0, securityDepositFils: 600 })
        .depositStatus,
    ).toBe("refunded");
    expect(
      c.terminationSettlement({ arrearsFils: 50, penaltyFils: 0, securityDepositFils: 0 }),
    ).toMatchObject({ remainingDueFils: 50, depositStatus: "refunded" });
  });
  it("periods to void after move-out", () => {
    expect(
      c.periodsToVoidAfter("2026-10-15", ["2026-09", "2026-10", "2026-11", "2026-12"]),
    ).toEqual(["2026-11", "2026-12"]);
  });
});

describe("unit status (derived)", () => {
  const base = {
    status: "active" as const,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    firstCollectionDate: "2026-01-01",
  };
  it("each status", () => {
    expect(c.deriveUnitStatus("2026-06-01", [])).toBe("vacant");
    expect(c.deriveUnitStatus("2026-06-01", [base])).toBe("occupied");
    expect(c.deriveUnitStatus("2026-06-01", [{ ...base, firstCollectionDate: "2026-08-01" }])).toBe(
      "in_grace",
    );
    expect(c.deriveUnitStatus("2026-06-01", [{ ...base, status: "notice_given" }])).toBe("notice");
    expect(c.deriveUnitStatus("2026-06-01", [{ ...base, hasOpenLegalCase: true }])).toBe("legal");
    expect(c.deriveUnitStatus("2025-06-01", [base])).toBe("reserved");
    expect(c.deriveUnitStatus("2026-06-01", [{ ...base, status: "draft" }])).toBe("vacant");
    expect(c.deriveUnitStatus("2026-06-01", [{ ...base, moveOutDate: "2026-05-31" }])).toBe(
      "vacant",
    );
  });
  it("covers period", () => {
    expect(c.coversPeriod(base, "2026-08")).toBe(true);
    expect(c.coversPeriod({ ...base, moveOutDate: "2026-05-10" }, "2026-06")).toBe(false);
    expect(c.coversPeriod({ ...base, status: "draft" }, "2026-06")).toBe(false);
  });
});
