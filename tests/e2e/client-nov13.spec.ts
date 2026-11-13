import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { login, supabaseUp } from "./helpers";
import { todayKuwait } from "../../src/domain/dates";
config({ path: ".env.local" });
const org = "0a000000-0000-4000-8000-000000000001";
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(new URL(url).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
test.beforeAll(async () => test.skip(!(await supabaseUp()), "Local Supabase required"));
test("property names remain complete and display choices persist", async ({ page }) => {
  const db = service(),
    name = "عقار اختبار اسم كامل طويل للغاية للعرض بدون اختصار أو إخفاء أي جزء منه";
  expect((await db.from("properties").insert({ org_id: org, name })).error).toBeNull();
  await login(page);
  await page.goto("/ar/properties");
  await page.getByRole("searchbox").fill(name);
  const title = page.getByRole("heading", { name, exact: true });
  await expect(title).toBeVisible();
  expect(await title.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  await page.getByRole("radio", { name: "بطاقات صغيرة", exact: true }).click();
  await expect(title).toBeVisible();
  await page.getByRole("radio", { name: "قائمة", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "قائمة", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "بطاقات كبيرة", exact: true }).click();
});
test("new owners preserve the property draft and counts can be cleared; typed unit numbers coexist", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ar/properties");
  await page.getByRole("button", { name: "عقار جديد", exact: true }).first().click();
  const name = "عقار مالك جديد " + Date.now();
  await page.locator("#p-name").fill(name);
  await page.locator("#p-governorate").selectOption("حولي");
  await page.locator("#p-area").selectOption("السالمية");
  await page.locator("#p-block").fill("1");
  await page.locator("#p-street").fill("7");
  await page.locator("#p-house").fill("99");
  await page.locator("#p-paci").fill("12345678");
  const ownerSelect = page.getByRole("dialog").getByLabel("الملاك", { exact: true });
  await expect(ownerSelect).toHaveValue("");
  await ownerSelect.selectOption("0c000000-0000-4000-8000-000000000001");
  await ownerSelect.selectOption("");
  await expect(ownerSelect).toHaveValue("");
  await page.getByRole("dialog").getByRole("button", { name: "إنشاء", exact: true }).click();
  const child = page.getByRole("dialog").last();
  await child.locator("#o-name").fill("مالك مضاف " + name);
  await child.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.locator("#p-name")).toHaveValue(name);
  await expect(ownerSelect).not.toHaveValue("");
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await page.locator("#plan-count-0").fill("");
  await expect(page.locator("#plan-count-0")).toHaveValue("");
  await page.locator("#plan-count-0").fill("12");
  await page.locator("#plan-floor-0").selectOption("0");
  await page.locator("#plan-type-0").selectOption("shop");
  await page.locator("#plan-start-0").fill("1");
  await page.getByRole("button", { name: "إضافة دور", exact: true }).click();
  await page.locator("#plan-floor-1").selectOption("0");
  await page.locator("#plan-count-1").fill("1");
  await page.locator("#plan-type-1").selectOption("office");
  await page.locator("#plan-start-1").fill("1");
  const save = page.getByRole("button", { name: "إنشاء العقار", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const db = service(),
    prop = await db.from("properties").select("id").eq("name", name).single();
  expect(prop.error).toBeNull();
  const pairs = await db
    .from("units")
    .select("label,type")
    .eq("property_id", prop.data!.id)
    .eq("label", "1");
  expect(pairs.data?.map((u) => u.type).sort()).toEqual(["office", "shop"]);
  await page.goto(`/ar/properties/${prop.data!.id}?tab=units`);
  await expect(page.getByText("مكتب 1", { exact: true })).toBeVisible();
  await expect(page.getByText("محل 1", { exact: true })).toBeVisible();
});
test("termination saves a printable immutable clearance and unit history can reprint it", async ({
  page,
}) => {
  const db = service();
  const owner = await db
    .from("owners")
    .insert({ org_id: org, full_name: "مالك نموذج الإخلاء الأصلي" })
    .select("id")
    .single();
  expect(owner.error).toBeNull();
  const prop = await db
    .from("properties")
    .insert({
      org_id: org,
      name: "عقار الإخلاء الأصلي",
      area: "الري",
      block: "1",
      street: "7",
      house_or_plot: "1674",
      paci_no: "12345678",
    })
    .select("id")
    .single();
  expect(prop.error).toBeNull();
  expect(
    (
      await db
        .from("property_owners")
        .insert({
          org_id: org,
          property_id: prop.data!.id,
          owner_id: owner.data!.id,
          share_pct: 100,
        })
    ).error,
  ).toBeNull();
  const unit = await db
    .from("units")
    .insert({ org_id: org, property_id: prop.data!.id, label: "2", type: "office" })
    .select("id")
    .single();
  expect(unit.error).toBeNull();
  const tenant = await db
    .from("tenants")
    .insert({ org_id: org, full_name: "مستأجر الإخلاء الأصلي", nationality: "كويتي" })
    .select("id")
    .single();
  expect(tenant.error).toBeNull();
  const lease = await db
    .from("contracts")
    .insert({
      org_id: org,
      property_id: prop.data!.id,
      owner_id: owner.data!.id,
      tenant_id: tenant.data!.id,
      contract_no: "CLEARANCE-" + Date.now(),
      type: "residential",
      contract_date: "2026-01-01",
      start_date: "2026-01-01",
      first_collection_date: "2026-01-01",
      end_date: "2026-12-31",
      term_months: 12,
      monthly_rent_fils: 100000,
      status: "active",
    })
    .select("id")
    .single();
  expect(lease.error).toBeNull();
  expect(
    (
      await db
        .from("contract_units")
        .insert({
          org_id: org,
          contract_id: lease.data!.id,
          unit_id: unit.data!.id,
          rent_share_fils: 100000,
        })
    ).error,
  ).toBeNull();
  await login(page);
  await page.goto(`/ar/contracts/${lease.data!.id}`);
  await page.getByRole("button", { name: "فسخ العقد", exact: true }).click();
  await page.locator("#t-reason").fill("طلب المستأجر الإخلاء");
  await page.getByRole("button", { name: "تأكيد الفسخ", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("تم حفظ نموذج الإخلاء");
  await page.getByRole("button", { name: "لاحقًا", exact: true }).click();
  const doc = await db
    .from("contract_clearances")
    .select("id,snapshot")
    .eq("contract_id", lease.data!.id)
    .single();
  expect(doc.error).toBeNull();
  await page.goto(`/print/clearance/${doc.data!.id}?lang=ar`);
  await expect(page.locator(".clearance-doc")).toContainText("مالك نموذج الإخلاء الأصلي");
  await expect(page.locator(".clearance-doc")).toContainText("مكتب 2");
  await expect(page.locator(".clearance-doc")).toContainText(
    todayKuwait().split("-").reverse().join("/"),
  );
  await page.screenshot({ path: "test-results/clearance-print.png", fullPage: true });
  expect(
    (await db.from("owners").update({ full_name: "اسم مالك معدل لاحقًا" }).eq("id", owner.data!.id))
      .error,
  ).toBeNull();
  expect(
    (await db.from("properties").update({ name: "اسم عقار معدل لاحقًا" }).eq("id", prop.data!.id))
      .error,
  ).toBeNull();
  expect(
    (
      await db
        .from("tenants")
        .update({ full_name: "اسم مستأجر معدل لاحقًا" })
        .eq("id", tenant.data!.id)
    ).error,
  ).toBeNull();
  await page.reload();
  await expect(page.locator(".clearance-doc")).toContainText("عقار الإخلاء الأصلي");
  await expect(page.locator(".clearance-doc")).toContainText("مستأجر الإخلاء الأصلي");
  await page.goto(`/ar/units/${unit.data!.id}`);
  await expect(page.getByRole("link", { name: "طباعة نموذج الإخلاء", exact: true })).toBeVisible();
});
