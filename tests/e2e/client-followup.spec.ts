import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { login, supabaseUp } from "./helpers";
import { addPeriods, todayKuwait, formatDate } from "../../src/domain/dates";
config({ path: ".env.local" });
const org = "0a000000-0000-4000-8000-000000000001";
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
test.beforeAll(async () => test.skip(!(await supabaseUp()), "Local Supabase required"));

test("nationality catalogue retains Iranian, hides Israel, and staff access is explained", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ar/tenants");
  await page.getByRole("button", { name: "مستأجر جديد", exact: true }).first().click();
  await expect(page.locator('#t-nat option[value="إيراني"]')).toHaveCount(1);
  expect(await page.locator("#t-nat option").allTextContents()).not.toContain("إسرائيل");
  await page.goto("/ar/settings/users");
  await expect(page.getByText("كيف يدخل الموظف إلى المكتب؟", { exact: true })).toHaveCount(1);
  await expect(page.getByText("كيف يدخل الموظف إلى المكتب؟", { exact: true })).toBeVisible();
  await expect(page.getByText(/لا ينشئ مكتبًا جديدًا/)).toBeVisible();
});

test("ongoing discount, bilingual month navigation, advance receipt and renewal work together", async ({
  page,
}) => {
  test.setTimeout(120000);
  const db = service();
  const name = "اختبار متابعة " + Date.now();
  const prop = await db.from("properties").insert({ org_id: org, name }).select("id").single();
  expect(prop.error).toBeNull();
  expect(
    (
      await db.from("property_owners").insert({
        org_id: org,
        property_id: prop.data!.id,
        owner_id: "0c000000-0000-4000-8000-000000000001",
        share_pct: 100,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await db.from("units").insert({
        org_id: org,
        property_id: prop.data!.id,
        label: "1",
        type: "apartment",
        asking_rent_fils: 600000,
      })
    ).error,
  ).toBeNull();
  const tenant = await db
    .from("tenants")
    .insert({ org_id: org, full_name: name, nationality: "إيراني" })
    .select("id")
    .single();
  expect(tenant.error).toBeNull();
  const today = todayKuwait();
  const firstPeriod = addPeriods(today.slice(0, 7), 6);
  await login(page);
  await page.goto("/ar/contracts/new");
  const next = page.getByRole("button", { name: "التالي", exact: true });
  await next.click();
  await page.locator("#w-owner").selectOption("0c000000-0000-4000-8000-000000000001");
  await page.getByRole("searchbox").fill(name);
  await page.locator("ul li button").first().click();
  await next.click();
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: /^1 — / }).click();
  await next.click();
  await page.locator("#w-start").fill(formatDate(firstPeriod + "-01"));
  await page.getByRole("radio", { name: "الطرف الأول", exact: true }).click();
  await page.locator("#w-notice").selectOption("0");
  await page.getByLabel("خصم الإيجار", { exact: true }).check();
  await page.locator("#discount-amount").fill("50");
  await expect(next).toBeDisabled();
  await expect(page.getByText("يرجى إدخال سبب الخصم للمتابعة.", { exact: true })).toBeVisible();
  await page.locator("#discount-to").click();
  await page.getByRole("button", { name: "السنة التالية", exact: true }).click();
  await page.getByRole("button", { name: "ديسمبر", exact: true }).click();
  await expect(page.locator("#discount-to")).toContainText(
    String(Number(firstPeriod.slice(0, 4)) + 1),
  );
  await page.getByLabel("دائم طوال مدة العقد", { exact: true }).check();
  await expect(page.locator("#discount-to")).toHaveCount(0);
  await page.locator("#discount-reason").fill("خصم دائم بموافقة المالك");
  await expect(next).toBeEnabled();
  await page.screenshot({ path: "test-results/client-ongoing-discount.png", fullPage: true });
  await next.click();
  await expect(page.getByText(/خصم شهري دائم قدره/)).toBeVisible();
  await next.click();
  await next.click();
  await page.getByRole("button", { name: "تفعيل العقد", exact: true }).click();
  await expect(page.getByRole("heading", { name: /تم تفعيل العقد/ })).toBeVisible();
  const href = await page
    .getByRole("link", { name: "فتح العقد", exact: true })
    .getAttribute("href");
  const id = href!.split("/").pop()!;
  const coupon = await db
    .from("contract_discounts")
    .select("to_period,amount_fils")
    .eq("contract_id", id)
    .single();
  expect(coupon.data).toMatchObject({ to_period: null, amount_fils: 50000 });
  await page.goto("/ar/collections");
  await page.getByRole("button", { name: "تحصيل مقدم", exact: true }).click();
  await page.getByRole("searchbox").fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(name) })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("#p-amount")).toHaveValue("550.000");
  await sheet.locator("#p-amount").fill("100");
  await sheet.locator("#p-receipt").fill("ADV-" + Date.now());
  await sheet.getByRole("button", { name: /حفظ الدفعة/ }).click();
  await expect(sheet).not.toBeVisible();
  const payment = await db
    .from("payments")
    .select("received_at,amount_fils,payment_allocations(amount_fils,charges(period))")
    .eq("contract_id", id)
    .single();
  expect(payment.error).toBeNull();
  expect(payment.data?.received_at).toBe(today);
  expect(payment.data?.amount_fils).toBe(100000);
  expect(payment.data?.payment_allocations).toHaveLength(1);
  expect(payment.data?.payment_allocations[0]?.charges).toMatchObject({ period: firstPeriod });
  const charges = await db
    .from("charges")
    .select("adjustments(amount_fils)")
    .eq("contract_id", id)
    .eq("kind", "rent");
  expect(charges.data?.length).toBeGreaterThan(0);
  expect(charges.data?.every((c) => c.adjustments[0]?.amount_fils === 50000)).toBe(true);
  await page.goto(`/print/statement/${prop.data!.id}/${today.slice(0, 7)}?lang=ar`);
  await expect(page.locator("tfoot")).toContainText("100.000");
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "خالية", exact: true })).toHaveCount(1);
  await page.goto(href!);
  await page.getByRole("button", { name: "تجديد", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "تجديد", exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  const renewed = await db
    .from("contracts")
    .select("id,initial_discount")
    .eq("renewed_from_id", id)
    .single();
  expect(renewed.error).toBeNull();
  expect(renewed.data?.initial_discount).toMatchObject({ toPeriod: null, amountFils: 50000 });
  expect(
    (await db.from("contract_discounts").select("amount_fils").eq("contract_id", renewed.data!.id))
      .data,
  ).toEqual([{ amount_fils: 50000 }]);
});
