import { describe, expect, it } from "vitest";
import { buildDemoData, demoDataset } from "@/demo/demo-data";
import {
  accountingReport,
  delta,
  expenseReport,
  expiringContracts,
  Index,
  lateTotals,
  lateUnits,
  monthlyStatement,
  monthlySummary,
  occupancySnapshot,
  ownerStatement,
  paymentHeatmap,
  upcomingFirstCollections,
  vacantUnits,
} from "@/domain/reports";
import { tafqeetKWD } from "@/domain/tafqeet";

const demo = buildDemoData();
const ds = demoDataset(demo);
const idx = new Index(ds);
const prop = (name: string) => demo.properties.find((p) => p.name.startsWith(name))!.id;

describe("Jabriya 157 — August 2026 statement (validation dataset)", () => {
  const s = monthlyStatement(idx, prop("الجابرية"), "2026-08");
  it("totals match the paper statement", () => {
    expect(s.totals.rentFils).toBe(8_960_000);
    expect(s.totals.collectedFils).toBe(8_890_000);
    expect(s.totals.arrearsFils).toBe(70_000);
    expect(s.totals.vacantCount).toBe(4);
    expect(s.fromDate).toBe("2026-08-01");
    expect(s.toDate).toBe("2026-08-31");
  });
  it("arrears only on units 9 (20.000) and 20 (50.000)", () => {
    const late = s.rows.filter((r) => r.arrearsFils > 0).map((r) => [r.unitLabels, r.arrearsFils]);
    expect(late).toEqual([
      ["تسعة", 20_000],
      ["عشرون", 50_000],
    ]);
    expect(s.rows.find((r) => r.unitLabels === "تسعة")!.status).toBe("partial");
  });
  it("vacant rows are labelled and ordered; multi-unit row joined", () => {
    const vacant = s.rows.filter((r) => r.vacant).map((r) => r.unitLabels);
    expect(vacant).toEqual(["محل", "نصف السرداب الأمامي", "نصف السرداب الخلفي", "السطح"]);
    expect(s.rows.some((r) => r.unitLabels === "22, 23, 24" && r.rentFils === 2_150_000)).toBe(
      true,
    );
    expect(s.rows[0]!.unitLabels).toBe("واحد");
    expect(s.rows).toHaveLength(27);
  });
  it("each row has receipts, last payment date in August, legal = لا يوجد", () => {
    for (const r of s.rows.filter((x) => !x.vacant)) {
      expect(r.receiptNos.length).toBeGreaterThan(0);
      r.receiptNos.forEach((n) => expect(n).toMatch(/^\d{4,5}$/));
      expect(r.lastPaymentDate! >= "2026-08-01" && r.lastPaymentDate! <= "2026-08-25").toBe(true);
      expect(r.legalLabel).toBe("لا يوجد");
      expect(r.previousFils + r.nextFils).toBe(0);
    }
  });
  it("July was fully paid; September carries arrears forward", () => {
    expect(monthlyStatement(idx, prop("الجابرية"), "2026-07").totals.arrearsFils).toBe(0);
    const sep = monthlyStatement(idx, prop("الجابرية"), "2026-09");
    const unit9 = sep.rows.find((r) => r.unitLabels === "تسعة")!;
    expect(unit9.arrearsFils).toBe(20_000 + 320_000);
  });
  it("unknown property throws", () =>
    expect(() => monthlyStatement(idx, "nope", "2026-08")).toThrow());
});

describe("August 2026 cover summary", () => {
  const s = monthlySummary(idx, "2026-08");
  it("17,475 / 17,280 / 195 / 0", () => {
    expect(s.collectedFils).toBe(17_475_000);
    expect(s.depositsFils).toBe(17_280_000);
    expect(s.expensesFils).toBe(195_000);
    expect(s.differenceFils).toBe(0);
  });
  it("per-property expenses show the split photocopy line", () => {
    const j = s.rows.find((r) => r.propertyId === prop("الجابرية"))!;
    const sal = s.rows.find((r) => r.propertyId === prop("السالمية"))!;
    expect(j.expensesFils).toBe(192_625);
    expect(sal.expensesFils).toBe(2_375);
    expect(j.depositsFils + sal.depositsFils).toBe(8_697_375 + 7_582_625);
  });
  it("owner-scoped summary", () => {
    const ownerB = demo.owners[1]!.id;
    const o = monthlySummary(idx, "2026-08", { ownerId: ownerB });
    expect(o.rows).toHaveLength(1);
    expect(o.collectedFils).toBe(400_000);
    const p = monthlySummary(ds, "2026-08", { propertyIds: [prop("الجابرية")] });
    expect(p.expensesFils).toBe(192_625);
  });
  it("voucher words", () => expect(tafqeetKWD(195_000)).toBe("فقط مائة وخمسة وتسعون دينار لا غير"));
});

describe("late & vacant units", () => {
  it("late units as of 30/09/2026 include the legal case with 3 months", () => {
    const rows = lateUnits(idx, "2026-09-30");
    const legal = rows.find((r) => r.legalStatus === "in_progress")!;
    expect(legal.monthsOverdue).toBe(3);
    expect(legal.amountFils).toBe(1_350_000);
    expect(legal.bucket).toBe("d90_plus");
    const t = lateTotals(rows);
    expect(t.count).toBe(rows.length);
    expect(t.amountFils).toBe(rows.reduce((a, r) => a + r.amountFils, 0));
    expect(
      lateUnits(idx, "2026-08-31", { propertyIds: [prop("الجابرية")] }).map((r) => r.amountFils),
    ).toEqual([50_000, 20_000]);
    expect(lateUnits(ds, "2026-08-31", { propertyIds: ["none"] })).toEqual([]);
  });
  it("vacant units", () => {
    const rows = vacantUnits(idx, "2026-09-30");
    const jab = rows.filter((r) => r.propertyId === prop("الجابرية"));
    expect(jab).toHaveLength(4);
    expect(jab[0]!.lostRentFils).toBeGreaterThan(0);
    // Al-Rai shop 8 is reserved (contract starts 01/10) but still vacant today.
    expect(rows.some((r) => r.propertyId === prop("الري") && r.label === "8")).toBe(true);
    expect(
      vacantUnits(ds, "2026-09-30", { propertyIds: [prop("صباح")] }).map((r) => r.label),
    ).toEqual(["1", "2"]);
  });
  it("occupancy snapshot", () => {
    const o = occupancySnapshot(idx, "2026-09-30", { propertyIds: [prop("الجابرية")] });
    expect(o).toMatchObject({ occupied: 25, vacant: 4, grace: 0, total: 29 });
    expect(occupancySnapshot(ds, "2026-10-15").grace).toBe(1);
  });
});

describe("accounting report", () => {
  it("quarter with comparison and KPIs", () => {
    const r = accountingReport(idx, "2026-07", "2026-09", {
      propertyIds: [prop("الجابرية")],
      withComparison: true,
    });
    expect(r.expectedFils).toBe(3 * 8_960_000);
    expect(r.closingArrearsFils).toBe(r.months.at(-1)!.arrearsFils);
    expect(r.openingArrearsFils).toBe(0);
    expect(r.expensesFils).toBe(192_625);
    expect(r.noiFils).toBe(r.collectedFils - r.expensesFils - r.commissionFils);
    expect(r.collectionRate).toBeGreaterThan(0.7);
    expect(r.occupancyRate).toBeCloseTo(25 / 29, 5);
    expect(r.vacancyLossFils).toBeGreaterThan(0);
    expect(r.grossPotentialFils).toBe(r.expectedFils + r.vacancyLossFils);
    expect(r.previous).toBeDefined();
    expect(r.collectedCurrentFils + r.collectedArrearsFils + r.collectedAdvanceFils).toBe(
      r.collectedFils,
    );
    expect(r.expensesByCategory[0]!.categoryName).toBe("راتب شهري");
  });
  it("free months are concessions (Al-Rai, Q4 2026)", () => {
    const r = accountingReport(ds, "2026-10", "2026-12", { propertyIds: [prop("الري")] });
    expect(r.freeMonthsFils).toBe(2 * 650_000);
    expect(r.concessionsFils).toBe(r.freeMonthsFils + r.discountsFils);
  });
  it("year report and commission", () => {
    const withCommission = {
      ...ds,
      properties: ds.properties.map((p, i) => ({
        ...p,
        commission:
          i === 0
            ? { kind: "percent" as const, value: 5 }
            : i === 2
              ? { kind: "fixed" as const, value: 10_000 }
              : null,
      })),
    };
    const r = accountingReport(withCommission, "2026-01", "2026-12");
    expect(r.commissionFils).toBeGreaterThan(0);
    expect(r.moveIns).toBeGreaterThan(0);
    expect(r.avgDaysLate).toBeGreaterThanOrEqual(0);
  });
  it("asOf caps arrears for future months", () => {
    const r = accountingReport(idx, "2026-01", "2026-12", { asOf: "2026-09-30" });
    const uncapped = accountingReport(idx, "2026-01", "2026-12");
    expect(r.closingArrearsFils).toBeLessThan(uncapped.closingArrearsFils);
    expect(r.months.at(-1)!.arrearsFils).toBe(
      r.months.find((m) => m.period === "2026-09")!.arrearsFils,
    );
    expect(r.collectionRate).toBeLessThanOrEqual(1);
  });
  it("delta", () => {
    expect(delta(110, 100)).toEqual({ delta: 10, pct: 0.1 });
    expect(delta(5, 0)).toEqual({ delta: 5, pct: null });
  });
});

describe("owner statement, expiring, grace, expenses, heatmap", () => {
  it("owner statement", () => {
    const s = ownerStatement(idx, demo.owners[0]!.id, "2026-08", "2026-08");
    expect(s.rows).toHaveLength(3);
    expect(s.collectedFils).toBe(17_475_000 - 400_000);
    expect(s.balanceFils).toBe(s.netPayableFils - s.depositsFils);
    // Aug 29 deposit split: Jabriya 8,697.375 + Salmiya 7,582.625 + Al-Rai 600 belong to owner A.
    expect(s.depositsFils).toBe(8_697_375 + 7_582_625 + 600_000);
    const sOwnerB = ownerStatement(idx, demo.owners[1]!.id, "2026-08", "2026-08");
    expect(sOwnerB.depositsFils).toBe(400_000);
    const noShares = ownerStatement(
      { ...ds, propertyOwners: [] },
      demo.owners[1]!.id,
      "2026-08",
      "2026-08",
    );
    expect(noShares.collectedFils).toBe(400_000);
  });
  it("expiring in 45 days", () => {
    const rows = expiringContracts(idx, "2026-09-30", 60);
    expect(rows.map((r) => r.daysLeft)).toContain(45);
    expect(expiringContracts(ds, "2026-09-30", 30)).toHaveLength(0);
  });
  it("upcoming first collection 01/12/2026", () => {
    const rows = upcomingFirstCollections(idx, "2026-10-15", 60);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.firstCollectionDate).toBe("2026-12-01");
    expect(upcomingFirstCollections(ds, "2026-09-30")).toHaveLength(0);
  });
  it("expense report groupings", () => {
    expect(expenseReport(idx, "2026-08", "2026-08", "category").map((r) => r.amountFils)).toEqual([
      170_000, 20_250, 4_750,
    ]);
    expect(expenseReport(idx, "2026-08", "2026-08", "property")[0]!.amountFils).toBe(192_625);
    expect(expenseReport(idx, "2026-08", "2026-08", "beneficiary")).toHaveLength(3);
    expect(
      expenseReport(ds, "2026-01", "2026-12", "period", { propertyIds: [prop("السالمية")] }),
    ).toEqual([{ key: "2026-08", label: "2026-08", amountFils: 2_375, count: 1 }]);
  });
  it("heatmap statuses", () => {
    const rows = paymentHeatmap(idx, ["2026-07", "2026-08", "2026-09"], "2026-09-30");
    const u9 = rows.find((r) => r.label === "تسعة")!;
    expect(u9.cells.map((c) => c.status)).toEqual(["paid", "partial", "unpaid"]);
    const vacant = rows.find((r) => r.label === "السطح")!;
    expect(vacant.cells.every((c) => c.status === "vacant")).toBe(true);
    const shop3 = rows.find((r) => r.propertyName.startsWith("الري") && r.label === "3")!;
    expect(shop3.cells.map((c) => c.status)).toEqual(["legal", "legal", "legal"]);
    const sabah = paymentHeatmap(ds, ["2026-10", "2026-11"], "2026-09-30").find(
      (r) => r.propertyName.startsWith("صباح") && r.label === "3",
    )!;
    expect(sabah.cells.map((c) => c.status)).toEqual(["advance", "advance"]);
  });
});
