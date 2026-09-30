import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { login, supabaseUp } from "./helpers";

const TYPES = [
  "statement",
  "summary",
  "late",
  "vacant",
  "accounting",
  "owner",
  "ledger",
  "expiring",
  "expenses",
  "grace",
];

test.describe("reports", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "Supabase is not running (supabase start) — e2e skipped");
  });

  test("every report renders, prints and exports Excel", async ({ page, request }) => {
    test.setTimeout(240_000);
    await login(page);
    for (const type of TYPES) {
      const q =
        type === "ledger"
          ? "?tenant=0f000000-0000-4000-8000-000000000010"
          : type === "accounting"
            ? "?preset=this_quarter"
            : "";
      await page.goto(`/ar/reports/${type}${q}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const print = await page.request.get(`/print/report/${type}${q || "?"}&lang=ar`);
      expect(print.status(), `print ${type}`).toBe(200);
      const res = await page.request.get(`/api/export/report/${type}${q || "?"}&lang=ar`);
      expect(res.status(), `excel ${type}`).toBe(200);
      expect(res.headers()["content-type"]).toContain("spreadsheetml");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
      expect(wb.worksheets.length).toBeGreaterThan(0);
      const moneyCell = wb.worksheets.flatMap((ws) => ws.getSheetValues()).length;
      expect(moneyCell).toBeGreaterThan(0);
    }
    void request;
  });

  test("late units report groups by property and shows the legal case", async ({ page }) => {
    await login(page);
    await page.goto("/ar/reports/late");
    await expect(page.getByText("منظورة").first()).toBeVisible();
    await expect(page.locator("table").getByText("الري قسيمة 1674").first()).toBeVisible();
  });

  test("accounting shows free months as concessions", async ({ page }) => {
    await login(page);
    await page.goto(
      "/ar/reports/accounting?preset=custom&from=2026-10&to=2026-12&property=0d000000-0000-4000-8000-000000000002",
    );
    await expect(page.getByText("التنازلات (أشهر مجانية وخصومات)")).toBeVisible();
    await expect(page.getByText("1,300.000 د.ك").first()).toBeVisible();
  });
});
