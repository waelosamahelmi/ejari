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
test("future rent revisions persist, payments stay chronological and pre-start cancellation saves clearance", async ({
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
      await db.from("property_owners").insert({
        org_id: org,
        property_id: prop.data!.id,
        owner_id: owner.data!.id,
        share_pct: 100,
      })
    ).error,
  ).toBeNull();
  const unit = await db
    .from("units")
    .insert({
      org_id: org,
      property_id: prop.data!.id,
      label: "2",
      type: "other",
      type_label: "دوبلكس",
      paci_no: "87654321",
    })
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
      start_date: "2027-02-01",
      first_collection_date: "2027-02-01",
      end_date: "2028-01-31",
      term_months: 12,
      monthly_rent_fils: 320000,
      status: "active",
    })
    .select("id")
    .single();
  expect(lease.error).toBeNull();
  expect(
    (
      await db.from("contract_units").insert({
        org_id: org,
        contract_id: lease.data!.id,
        unit_id: unit.data!.id,
        rent_share_fils: 320000,
      })
    ).error,
  ).toBeNull();
  await login(page);
  await page.goto(`/ar/contracts/${lease.data!.id}`);
  await page.getByRole("button", { name: "تعديل الإيجار", exact: true }).click();
  await page.locator("#r-from").fill("01/12/2026");
  await page.locator("#r-amt").fill("280");
  await page.getByRole("dialog").getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("280.000 د.ك", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "تعديل الإيجار", exact: true }).click();
  await expect(page.locator("#r-amt")).toHaveValue("280.000");
  await page.locator("#r-amt").fill("270");
  await page.getByRole("dialog").getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("270.000 د.ك", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "سجّل دفعة", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: "اختيار الأشهر", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "أبريل 2027", exact: true })).toBeDisabled();
  await sheet.getByRole("button", { name: "مارس 2027", exact: true }).click();
  await expect(sheet.locator("#p-amount")).toHaveValue("540.000");
  await sheet.locator("#p-amount").fill("100");
  await sheet.getByRole("button", { name: /حفظ الدفعة/ }).click();
  await expect(sheet).toHaveCount(0);
  const receipt = await db.from("payments").select("id").eq("contract_id", lease.data!.id).single();
  expect(receipt.error).toBeNull();
  await page.goto(`/print/receipt/${receipt.data!.id}?lang=ar`);
  await expect(page.getByRole("banner")).toContainText("دوبلكس 2");
  await page.goto(`/print/contract/${lease.data!.id}?lang=ar`);
  await expect(page.locator(".contract-doc")).toContainText("87654321");
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
  const charges = await db.from("charges").select("voided").eq("contract_id", lease.data!.id);
  expect(charges.data?.length).toBeGreaterThan(0);
  expect(charges.data?.every((c) => c.voided)).toBe(true);
  expect(
    (
      await db
        .from("payment_allocations")
        .select("id,payments!inner(contract_id)")
        .eq("payments.contract_id", lease.data!.id)
    ).data,
  ).toEqual([]);

  await page.goto(`/print/clearance/${doc.data!.id}?lang=ar`);
  await expect(page.locator(".clearance-doc")).toContainText("مالك نموذج الإخلاء الأصلي");
  await expect(page.locator(".clearance-doc")).toContainText("دوبلكس 2");
  await expect(page.locator(".clearance-doc")).toContainText(
    todayKuwait().split("-").reverse().join("/"),
  );
  await page.screenshot({ path: "test-results/nov17-clearance-print.png", fullPage: true });
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
test("unit form offers studios and preserves a new custom type", async ({ page }) => {
  const db = service();
  const name = "أنواع الوحدات " + Date.now();
  const prop = await db.from("properties").insert({ org_id: org, name }).select("id").single();
  expect(prop.error).toBeNull();
  await login(page);
  await page.goto(`/ar/properties/${prop.data!.id}?tab=units`);
  await page.getByRole("button", { name: "وحدة جديدة", exact: true }).click();
  await expect(page.locator('#u-type option[value="studio"]')).toHaveText("استوديو");
  await page.locator("#u-label").fill("1");
  await page.locator("#u-type").selectOption("other");
  await page.locator("#u-type-label").fill("دوبلكس خاص");
  await page.getByRole("dialog").getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const unit = await db
    .from("units")
    .select("id,type,type_label")
    .eq("property_id", prop.data!.id)
    .single();
  expect(unit.data).toMatchObject({ type: "other", type_label: "دوبلكس خاص" });
  await page.goto(`/ar/units/${unit.data!.id}`);
  await expect(page.getByText("دوبلكس خاص", { exact: true }).first()).toBeVisible();
});

test("switching touch capabilities preserves the contract draft and wizard step", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    baseURL: "http://localhost:3100",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: false,
  });
  try {
    const page = await ctx.newPage();
    await login(page);
    await page.goto("/ar/contracts/new");
    await page.getByRole("button", { name: "استثماري" }).click();
    await page.getByRole("button", { name: "التالي", exact: true }).click();
    await page.locator("#w-owner").selectOption("0c000000-0000-4000-8000-000000000001");
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await page.waitForFunction(() => matchMedia("(pointer: coarse)").matches);
    await expect(page.locator("#w-owner")).toHaveValue("0c000000-0000-4000-8000-000000000001");
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await page.waitForFunction(() => !matchMedia("(pointer: coarse)").matches);
    await expect(page.locator("#w-owner")).toHaveValue("0c000000-0000-4000-8000-000000000001");
  } finally {
    await ctx.close();
  }
});
