import { test, expect } from "@playwright/test";
import { IDS, login, supabaseUp } from "./helpers";

test.describe("collections", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "Supabase is not running (supabase start) — e2e skipped");
  });

  test("Jabriya August statement matches the paper figures", async ({ page }) => {
    await login(page);
    await page.goto(`/print/statement/${IDS.jabriya}/2026-08?lang=ar`);
    const foot = page.locator("tfoot");
    await expect(foot).toContainText("8,960.000");
    await expect(foot).toContainText("8,890.000");
    await expect(foot).toContainText("70.000");
    await expect(page.getByRole("cell", { name: "خالية" })).toHaveCount(4);
  });

  test("record a payment and the arrears update", async ({ page }) => {
    await login(page);
    await page.goto(`/ar/collections?period=2026-09&property=${IDS.jabriya}`);
    const row = page.getByRole("row").filter({ hasText: "تسعة" }).first();
    await expect(row).toContainText("340.000");
    await row.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("المستحق حتى اليوم")).toBeVisible();
    await sheet.getByLabel("رقم الإيصال").fill("77341");
    await page.getByRole("button", { name: /حفظ الدفعة/ }).click();
    await expect(page.getByText(/تم تسجيل/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("row").filter({ hasText: "تسعة" }).first()).toContainText("77341");
    const updated = page.getByRole("row").filter({ hasText: "تسعة" }).first();
    await expect(updated).toContainText("20.000 سابق");
    await expect(updated).toContainText("مدفوع");
  });
});
