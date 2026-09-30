import { describe, expect, it } from "vitest";
import * as d from "@/domain/dates";

describe("day names (verified)", () => {
  it("2026-02-01 = الأحد, 2026-10-01 = الخميس", () => {
    expect(d.dayNameAr("2026-02-01")).toBe("الأحد");
    expect(d.dayNameAr("2026-10-01")).toBe("الخميس");
    expect(d.dayNameEn("2026-10-01")).toBe("Thursday");
  });
});

describe("date arithmetic", () => {
  it("addDays / addMonths clamp", () => {
    expect(d.addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(d.addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(d.addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(d.addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(d.addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });
  it("contract end date", () => {
    expect(d.contractEndDate("2026-02-01", 60)).toBe("2031-01-31");
    expect(d.contractEndDate("2025-11-15", 12)).toBe("2026-11-14");
  });
  it("diffDays / compare / min / max", () => {
    expect(d.diffDays("2026-08-01", "2026-08-31")).toBe(30);
    expect(d.compareDates("2026-01-01", "2026-01-02")).toBe(-1);
    expect(d.compareDates("2026-01-02", "2026-01-01")).toBe(1);
    expect(d.compareDates("2026-01-01", "2026-01-01")).toBe(0);
    expect(d.minDate("2026-01-01", "2025-01-01")).toBe("2025-01-01");
    expect(d.maxDate("2026-01-01", "2025-01-01")).toBe("2026-01-01");
  });
  it("monthsBetween", () => {
    expect(d.monthsBetween("2026-10-01", "2026-12-01")).toBe(2);
    expect(d.monthsBetween("2026-10-15", "2026-12-01")).toBe(1);
  });
  it("validation", () => {
    expect(d.isValidDate("2026-02-30")).toBe(false);
    expect(d.isValidDate("2026-13-01")).toBe(false);
    expect(d.isValidDate("nope")).toBe(false);
    expect(d.isValidDate("2026-02-28")).toBe(true);
    expect(d.isValidPeriod("2026-13")).toBe(false);
    expect(d.isValidPeriod("x")).toBe(false);
    expect(d.isValidPeriod("2026-08")).toBe(true);
  });
});

describe("periods", () => {
  it("helpers", () => {
    expect(d.periodOf("2026-08-15")).toBe("2026-08");
    expect(d.addPeriods("2026-12", 1)).toBe("2027-01");
    expect(d.addPeriods("2026-01", -1)).toBe("2025-12");
    expect(d.diffPeriods("2026-01", "2026-12")).toBe(11);
    expect(d.periodStart("2026-08")).toBe("2026-08-01");
    expect(d.periodEnd("2026-02")).toBe("2026-02-28");
    expect(d.periodDays("2028-02")).toBe(29);
    expect(d.periodRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(d.periodRange("2026-11", "2026-10")).toEqual([]);
  });
  it("format", () => {
    expect(d.formatPeriod("2026-08")).toBe("أغسطس 2026");
    expect(d.formatPeriod("2026-08", "en")).toBe("August 2026");
    expect(d.formatDate("2026-02-01")).toBe("01/02/2026");
    expect(d.formatDate(null)).toBe("");
    expect(d.monthNameAr(12)).toBe("ديسمبر");
    expect(() => d.monthNameAr(13)).toThrow();
    expect(() => d.monthNameEn(0)).toThrow();
  });
  it("parseDisplayDate", () => {
    expect(d.parseDisplayDate("01/10/2026")).toBe("2026-10-01");
    expect(d.parseDisplayDate("٠١/١٠/٢٠٢٦")).toBe("2026-10-01");
    expect(d.parseDisplayDate("31/02/2026")).toBeNull();
    expect(d.parseDisplayDate("hello")).toBeNull();
  });
  it("today and hour in Kuwait", () => {
    expect(d.todayKuwait(new Date("2026-09-29T22:30:00Z"))).toBe("2026-09-30");
    expect(d.hourKuwait(new Date("2026-09-29T22:30:00Z"))).toBe(1);
  });
  it("presets", () => {
    const t = "2026-08-15";
    expect(d.presetRange("this_month", t)).toEqual({ from: "2026-08", to: "2026-08" });
    expect(d.presetRange("last_month", t)).toEqual({ from: "2026-07", to: "2026-07" });
    expect(d.presetRange("this_quarter", t)).toEqual({ from: "2026-07", to: "2026-09" });
    expect(d.presetRange("last_quarter", t)).toEqual({ from: "2026-04", to: "2026-06" });
    expect(d.presetRange("h1", t)).toEqual({ from: "2026-01", to: "2026-06" });
    expect(d.presetRange("h2", t)).toEqual({ from: "2026-07", to: "2026-12" });
    expect(d.presetRange("this_year", t)).toEqual({ from: "2026-01", to: "2026-12" });
    expect(d.presetRange("last_year", t)).toEqual({ from: "2025-01", to: "2025-12" });
    expect(d.previousRange("2026-07", "2026-09")).toEqual({ from: "2026-04", to: "2026-06" });
  });
});
