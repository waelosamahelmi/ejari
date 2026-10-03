import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { login, supabaseUp } from "./helpers";

config({ path: ".env.local" });

test.describe("property creation: Kuwait address + unit planner", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await supabaseUp()), "Supabase not running");
    await login(page, "admin", "ar");
  });

  test("creates an uneven building and renders it in the stack", async ({ page }) => {
    await page.goto("/ar/properties");
    await page.getByRole("button", { name: "عقار جديد" }).first().click();
    await page.locator("#p-name").fill("برج الاختبار");
    await page.locator("#p-governorate").selectOption("حولي");
    await page.locator("#p-area").selectOption("السالمية");
    await page.locator("#p-block").fill("10");
    await page.locator("#p-street").fill("5");
    await page.locator("#p-house").fill("123");
    await page.locator("#p-paci").fill("12345678");
    await page.getByRole("button", { name: "التالي" }).click();

    // Ground: 2 shops (S1, S2)
    await page.locator("#plan-floor-0").selectOption("0");
    await page.locator("#plan-count-0").fill("2");
    await page.locator("#plan-type-0").selectOption("shop");
    await page.locator("#plan-prefix-0").fill("S");
    await page.locator("#plan-start-0").fill("1");

    const addFloor = async (row: number, floor: number, count: number, start: number) => {
      await page.getByRole("button", { name: "إضافة دور" }).click();
      await page.locator(`#plan-floor-${row}`).selectOption(String(floor));
      await page.locator(`#plan-count-${row}`).fill(String(count));
      await page.locator(`#plan-start-${row}`).fill(String(start));
    };
    await addFloor(1, 1, 4, 101);
    await addFloor(2, 2, 3, 201);
    await addFloor(3, 3, 5, 301);

    await expect(page.getByText(/الإجمالي/)).toBeVisible();
    const labels = page.locator('input[aria-label^="رقم الوحدة"]');
    await expect(labels).toHaveCount(14);
    await expect(labels.nth(13)).toHaveValue("305");

    await page.getByRole("button", { name: "إنشاء العقار" }).click();
    await expect(page.getByText("برج الاختبار")).toBeVisible({ timeout: 15_000 });

    // The card shows 14 units (derived from the real units rows).
    await expect(page.getByText("14 وحدة").first()).toBeVisible();

    // Search by governorate finds the property.
    await page.getByPlaceholder(/ابحث/).fill("حولي");
    await expect(page.getByText("برج الاختبار")).toBeVisible();

    // Open it: units tab shows the generated units grouped on the right floors.
    await page.getByRole("link", { name: /برج الاختبار/ }).first().click();
    await page.getByRole("button", { name: "الوحدات" }).click();
    await expect(page.getByText("S1", { exact: true })).toBeVisible();
    await expect(page.getByText("301", { exact: true })).toBeVisible();
    await expect(page.getByText("S2", { exact: true })).toBeVisible();
  });

  test("changing the governorate filters the area list", async ({ page }) => {
    await page.goto("/ar/properties");
    await page.getByRole("button", { name: "عقار جديد" }).first().click();
    await page.locator("#p-governorate").selectOption("حولي");
    await expect(page.locator('#p-area option[value="السالمية"]')).toHaveCount(1);
    await page.locator("#p-governorate").selectOption("الجهراء");
    await expect(page.locator('#p-area option[value="السالمية"]')).toHaveCount(0);
    await expect(page.locator('#p-area option[value="الجهراء"]')).toHaveCount(1);
  });

  test("add units later, then plan them from the Units tab", async ({ page }) => {
    await page.goto("/ar/properties");
    await page.getByRole("button", { name: "عقار جديد" }).first().click();
    await page.locator("#p-name").fill("مبنى الإضافة لاحقًا");
    await page.locator("#p-governorate").selectOption("مبارك الكبير");
    await page.locator("#p-area").selectOption("العدان");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("radio", { name: "إضافة الوحدات لاحقًا" }).click();
    await page.getByRole("button", { name: "إنشاء العقار" }).click();
    await expect(page.getByText("مبنى الإضافة لاحقًا")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: /مبنى الإضافة لاحقًا/ }).first().click();
    await page.getByRole("button", { name: "الوحدات" }).click();
    await page.getByRole("button", { name: "إضافة وحدات" }).click();
    await page.locator("#plan-count-0").fill("2");
    await page.locator("#plan-type-0").selectOption("shop");
    await page.locator("#plan-prefix-0").fill("M");
    await page.locator("#plan-start-0").fill("1");
    await page.getByRole("button", { name: "تمت إضافة 2 وحدة" }).click();
    await expect(page.getByText("M1", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("M2", { exact: true })).toBeVisible();
  });
});
