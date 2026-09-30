import { describe, expect, it } from "vitest";
import { buildDemoData, demoDataset } from "@/demo/demo-data";
import { Index } from "@/domain/reports";
import {
  digestSummary,
  expiryBucket,
  reachedThreshold,
  scheduledEvents,
} from "@/domain/notifications";

const demo = buildDemoData();
const idx = new Index(demoDataset(demo));
const opts = {
  lateDays: [3, 7, 15, 30],
  closedPeriods: [] as string[],
  tenantName: () => "مستأجر",
};

describe("notification thresholds", () => {
  it("reachedThreshold picks the highest threshold reached", () => {
    expect(reachedThreshold(2, [3, 7, 15, 30])).toBeNull();
    expect(reachedThreshold(3, [3, 7, 15, 30])).toBe(3);
    expect(reachedThreshold(20, [30, 3, 15, 7])).toBe(15);
    expect(reachedThreshold(95, [3, 7, 15, 30])).toBe(30);
  });
  it("expiryBucket maps days left to 30/60/90", () => {
    expect(expiryBucket(0)).toBe(30);
    expect(expiryBucket(45)).toBe(60);
    expect(expiryBucket(90)).toBe(90);
    expect(expiryBucket(91)).toBeNull();
  });
});

describe("scheduledEvents on the demo dataset (30/09/2026)", () => {
  const ev = scheduledEvents(idx, "2026-09-30", opts);
  const keys = ev.map((e) => e.dedupeKey);
  it("flags late tenants once per threshold with stable dedupe keys", () => {
    const late = ev.filter((e) => e.type === "tenant_late");
    expect(late.length).toBeGreaterThan(0);
    expect(new Set(late.map((e) => e.dedupeKey)).size).toBe(late.length);
    expect(late.every((e) => Number(e.vars.days) >= 3)).toBe(true);
    // Same inputs → same keys (idempotent hourly cron).
    expect(scheduledEvents(idx, "2026-09-30", opts).map((e) => e.dedupeKey)).toEqual(keys);
  });
  it("warns about the contract expiring in 45 days in the 60-day window", () => {
    const exp = ev.filter((e) => e.type === "contract_expiring");
    expect(exp.some((e) => e.vars.days === 45 && e.dedupeKey.endsWith(":60"))).toBe(true);
  });
  it("reminds about the hearing the day before", () => {
    const h = ev.filter((e) => e.type === "hearing_tomorrow");
    expect(h).toHaveLength(1);
    expect(h[0]!.vars.date).toBe("01/10/2026");
    expect(
      scheduledEvents(idx, "2026-09-29", opts).some((e) => e.type === "hearing_tomorrow"),
    ).toBe(false);
  });
  it("no month-end reminder mid-month; reminder on the 1st unless closed", () => {
    expect(ev.some((e) => e.type === "month_end")).toBe(false);
    const oct1 = scheduledEvents(idx, "2026-10-01", opts);
    expect(oct1.find((e) => e.type === "month_end")?.dedupeKey).toBe("monthend:2026-09");
    expect(
      scheduledEvents(idx, "2026-10-01", { ...opts, closedPeriods: ["2026-09"] }).some(
        (e) => e.type === "month_end",
      ),
    ).toBe(false);
  });
  it("grace ending within 7 days of the first collection date", () => {
    expect(
      scheduledEvents(idx, "2026-11-24", opts).some(
        (e) => e.type === "grace_ending" && e.vars.date === "01/12/2026",
      ),
    ).toBe(true);
    expect(scheduledEvents(idx, "2026-11-20", opts).some((e) => e.type === "grace_ending")).toBe(
      false,
    );
  });
});

describe("digestSummary", () => {
  it("counts late units and totals their arrears", () => {
    const d = digestSummary(idx, "2026-09-30");
    expect(d.late).toBeGreaterThan(0);
    expect(d.amountFils).toBeGreaterThan(0);
    expect(digestSummary(idx, "2026-10-01").due).toBeGreaterThan(0);
  });
});
