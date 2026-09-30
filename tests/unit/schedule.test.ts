import { describe, expect, it } from "vitest";
import {
  effectiveEndDate,
  generateSchedule,
  graceMonths,
  nextPeriod,
  periodsToMaterialize,
  rentForPeriod,
  type ScheduleContract,
} from "@/domain/schedule";

const base: ScheduleContract = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  firstCollectionDate: "2026-01-01",
  monthlyRentFils: 300000,
};

describe("generateSchedule", () => {
  it("one rent charge per month", () => {
    const s = generateSchedule(base);
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({
      period: "2026-01",
      kind: "rent",
      amountFils: 300000,
      waivedValueFils: 0,
      dueDate: "2026-01-01",
    });
    expect(s.at(-1)!.period).toBe("2026-12");
  });
  it("free months (grace) become free lines with waived value", () => {
    const s = generateSchedule(
      {
        startDate: "2026-10-01",
        endDate: "2031-09-30",
        firstCollectionDate: "2026-12-01",
        monthlyRentFils: 650000,
        electricityFixedFils: 3750,
      },
      { until: "2027-01" },
    );
    expect(s.filter((c) => c.kind === "free")).toEqual([
      {
        period: "2026-10",
        kind: "free",
        amountFils: 0,
        waivedValueFils: 650000,
        dueDate: "2026-10-01",
      },
      {
        period: "2026-11",
        kind: "free",
        amountFils: 0,
        waivedValueFils: 650000,
        dueDate: "2026-11-01",
      },
    ]);
    const dec = s.filter((c) => c.period === "2026-12");
    expect(dec.map((c) => c.kind)).toEqual(["rent", "electricity_fixed"]);
    expect(dec[1]!.amountFils).toBe(3750);
    expect(s).toHaveLength(6);
  });
  it("mid-month start: full rent by default, prorated when enabled", () => {
    const c = {
      ...base,
      startDate: "2026-11-15",
      firstCollectionDate: "2026-11-15",
      endDate: "2027-11-14",
    };
    expect(generateSchedule(c)[0]).toMatchObject({ amountFils: 300000, dueDate: "2026-11-15" });
    const pr = generateSchedule(c, { prorate: true });
    expect(pr[0]!.amountFils).toBe(160000); // 16/30 days
    expect(pr.at(-1)!.amountFils).toBe(140000); // 14/30 days
  });
  it("prorated electricity", () => {
    const c = {
      ...base,
      startDate: "2026-11-16",
      firstCollectionDate: "2026-11-16",
      electricityFixedFils: 3000,
    };
    expect(generateSchedule(c, { prorate: true })[1]).toMatchObject({
      kind: "electricity_fixed",
      amountFils: 1500,
    });
  });
  it("move-out stops charges", () => {
    const s = generateSchedule({ ...base, moveOutDate: "2026-05-10" });
    expect(s.at(-1)!.period).toBe("2026-05");
    expect(effectiveEndDate({ endDate: "2026-12-31", moveOutDate: "2027-01-01" })).toBe(
      "2026-12-31",
    );
  });
  it("from/until clipping", () => {
    expect(
      generateSchedule(base, { from: "2026-06", until: "2026-07" }).map((c) => c.period),
    ).toEqual(["2026-06", "2026-07"]);
  });
  it("move-out before start → nothing; invalid first collection throws", () => {
    expect(generateSchedule({ ...base, moveOutDate: "2025-12-01" })).toEqual([]);
    expect(() => generateSchedule({ ...base, firstCollectionDate: "2025-12-01" })).toThrow();
  });
});

describe("rent revisions & increases", () => {
  it("revision applies from its month", () => {
    const c = { ...base, revisions: [{ effectiveFrom: "2026-07-01", monthlyRentFils: 320000 }] };
    expect(rentForPeriod(c, "2026-06")).toBe(300000);
    expect(rentForPeriod(c, "2026-07")).toBe(320000);
    expect(
      rentForPeriod(
        { ...base, revisions: [{ effectiveFrom: "2026-07-15", monthlyRentFils: 1 }] },
        "2026-07",
      ),
    ).toBe(1);
  });
  it("latest revision wins", () => {
    const c = {
      ...base,
      revisions: [
        { effectiveFrom: "2026-09-01", monthlyRentFils: 350000 },
        { effectiveFrom: "2026-03-01", monthlyRentFils: 310000 },
      ],
    };
    expect(rentForPeriod(c, "2026-05")).toBe(310000);
    expect(rentForPeriod(c, "2026-10")).toBe(350000);
  });
  it("annual increase percent and fixed", () => {
    const c: ScheduleContract = {
      ...base,
      endDate: "2028-12-31",
      annualIncrease: { kind: "percent", value: 5, everyMonths: 12 },
    };
    expect(rentForPeriod(c, "2026-12")).toBe(300000);
    expect(rentForPeriod(c, "2027-01")).toBe(315000);
    expect(rentForPeriod(c, "2028-01")).toBe(330750);
    const f: ScheduleContract = {
      ...base,
      annualIncrease: { kind: "fixed", value: 10000, everyMonths: 6 },
    };
    expect(rentForPeriod(f, "2026-07")).toBe(310000);
    const r: ScheduleContract = {
      ...c,
      revisions: [{ effectiveFrom: "2027-06-01", monthlyRentFils: 400000 }],
    };
    expect(rentForPeriod(r, "2027-12")).toBe(400000);
    expect(rentForPeriod(r, "2028-01")).toBe(420000);
  });
});

describe("helpers", () => {
  it("grace months", () => {
    expect(graceMonths("2026-10-01", "2026-12-01")).toBe(2);
    expect(graceMonths("2026-10-01", "2026-10-01")).toBe(0);
  });
  it("periods to materialize", () => {
    expect(periodsToMaterialize(base, "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(periodsToMaterialize(base, "2030-01")).toHaveLength(12);
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
});
