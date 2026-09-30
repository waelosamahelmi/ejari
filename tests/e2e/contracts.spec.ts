import { test, expect } from "@playwright/test";
import { login, supabaseUp } from "./helpers";

test.describe("contracts", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "Supabase is not running (supabase start) — e2e skipped");
  });

  test("create an investment contract via the wizard, activate and print", async ({ page }) => {
    await login(page);
    await page.goto("/ar/contracts/new");
    await page.getByRole("button", { name: /استثماري/ }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    // parties
    await page.getByRole("searchbox").fill("الشمري");
    await page.locator("ul li button").first().click();
    await page.getByRole("button", { name: "التالي" }).click();
    // property & units
    await page.getByRole("button", { name: "الري قسيمة 1674" }).click();
    await page.getByRole("button", { name: /^1 — / }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    // terms (rent prefilled from asking rent)
    await expect(page.getByLabel("الإيجار الشهري")).toHaveValue(/550/);
    await page.getByRole("button", { name: "التالي" }).click();
    // clauses
    await expect(page.getByText("استأجر الطرف الثاني محل رقم 1")).toBeVisible();
    await page.getByRole("button", { name: "التالي" }).click();
    // review
    await expect(page.getByText("أول الاستحقاقات")).toBeVisible();
    await page.getByRole("button", { name: "التالي" }).click();
    // finish
    await page.getByRole("button", { name: "تفعيل العقد" }).click();
    await expect(page.getByRole("heading", { name: /تم تفعيل العقد I-\d{4}-\d{4}/ })).toBeVisible({ timeout: 20_000 });
    const open = page.getByRole("link", { name: "فتح العقد" });
    const href = await open.getAttribute("href");
    const id = href!.split("/").pop()!;
    await page.goto(`/print/contract/${id}?lang=ar`);
    await expect(page.getByRole("heading", { name: "عقد إيجار" })).toBeVisible();
    await expect(page.getByText(/خمسمائة وخمسون/)).toBeVisible();
  });
});
