import { test, expect } from "@playwright/test";
import { login, supabaseUp } from "./helpers";

test.describe("expenses & deposits", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "Supabase is not running (supabase start) — e2e skipped");
  });

  test("seed voucher prints 195.000 in words with the split meter line", async ({ page }) => {
    await login(page);
    await page.goto("/print/voucher/1f000000-0000-4000-8000-000000000001?lang=ar");
    await expect(page.getByText("فقط مائة وخمسة وتسعون دينار لا غير")).toBeVisible();
    await expect(page.getByText("تصوير عداد الكهرباء الجابرية والسالمية")).toBeVisible();
    await expect(page.getByText("السالمية 88")).toBeVisible();
  });

  test("August cover summary reconciles to zero", async ({ page }) => {
    await login(page);
    await page.goto("/ar/deposits?period=2026-08");
    await expect(page.getByText("17,475.000").first()).toBeVisible();
    await expect(page.getByText("17,280.000").first()).toBeVisible();
    await expect(page.getByText("195.000").first()).toBeVisible();
    await expect(page.getByText("مطابق")).toBeVisible();
  });

  test("create a voucher split across two properties", async ({ page }) => {
    await login(page);
    await page.goto("/ar/expenses/new");
    await page.getByLabel("المبلغ").first().fill("10");
    await page.getByLabel("البيان").first().fill("تنظيف مداخل");
    await page.getByRole("button", { name: "بالتساوي" }).click();
    await page.getByRole("button", { name: "السالمية 88" }).click();
    await expect(page.getByText("5.000 د.ك").first()).toBeVisible();
    await page.getByRole("button", { name: "ترحيل السند" }).click();
    await expect(page).toHaveURL(/\/ar\/expenses\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    await expect(page.getByText("السالمية 88")).toBeVisible();
  });
});
