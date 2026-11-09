import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { login, supabaseUp, IDS } from "./helpers";
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

test("Arabic is the default even when the browser prefers English", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/ar(?:\/|$)/);
  await context.close();
});

test("nationality and company details are required and printed", async ({ page }) => {
  await login(page);
  await page.goto("/ar/tenants");
  await page.getByRole("button", { name: "مستأجر جديد", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#t-name").fill("شركة اختبار المتطلبات");
  await sheet.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(sheet.getByText("هذا الحقل مطلوب.", { exact: true })).toBeVisible();
  await sheet.locator("#t-party").selectOption("company");
  await sheet.locator("#t-licence").fill("2026/12345");
  await sheet.locator("#t-signatory").fill("مفوض اختبار");
  await sheet.locator("#t-signatory-cid").fill("285010112358");
  await sheet.locator("#t-nat").selectOption("كويتي");
  await sheet.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "شركة اختبار المتطلبات", exact: true }),
  ).toBeVisible();
  const db = service();
  const { data: tenant } = await db
    .from("tenants")
    .select("id,party_type,licence_no")
    .eq("full_name", "شركة اختبار المتطلبات")
    .single();
  expect(tenant?.party_type).toBe("company");
  expect(tenant?.licence_no).toBe("2026/12345");
  // Render a draft against a vacant shop; no real-client records are involved.
  const { data: contract, error } = await db
    .from("contracts")
    .insert({
      org_id: org,
      contract_no: "DRAFT-COMPANY-QA",
      type: "investment",
      tenant_id: tenant!.id,
      property_id: IDS.alRai,
      owner_id: "0c000000-0000-4000-8000-000000000001",
      contract_date: "2026-11-01",
      start_date: "2026-11-01",
      first_collection_date: "2026-11-01",
      end_date: "2027-10-31",
      term_months: 12,
      monthly_rent_fils: 550000,
      purpose: "محل تجاري",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const link = await db
    .from("contract_units")
    .insert({ org_id: org, contract_id: contract!.id, unit_id: IDS.alRaiShop1 });
  expect(link.error).toBeNull();
  await page.goto(`/print/contract/${contract!.id}?lang=ar`);
  await expect(page.locator(".contract-doc")).toContainText("رقم الترخيص: 2026/12345");
  await expect(page.locator(".contract-doc")).toContainText("المفوض بالتوقيع: مفوض اختبار");
  await db.from("contracts").delete().eq("id", contract!.id);
});

test("wizard requires owner and explicit terms, offers all tenants and filters properties", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ar/contracts/new");
  const next = page.getByRole("button", { name: "التالي", exact: true });
  await next.click();
  await expect(page.locator("ul li button .font-medium").first()).toBeVisible();
  const names = await page.locator("ul li button .font-medium").allTextContents();
  expect(names.length).toBeGreaterThan(8);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ar")));
  await page.getByRole("searchbox").fill("فهد جاسم");
  await page.locator("ul li button").first().click();
  await expect(next).toBeDisabled();
  await page.locator("#w-owner").selectOption("0c000000-0000-4000-8000-000000000002");
  await next.click();
  await expect(
    page.getByRole("button", { name: "صباح السالم قطعة 12 منزل 43", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "الري قسيمة 1674", exact: true })).toHaveCount(0);
  // Restart with the other owner; this tenant already holds a lease and can rent another unit.
  await page.goto("/ar/contracts/new");
  await next.click();
  await page.locator("#w-owner").selectOption("0c000000-0000-4000-8000-000000000001");
  await page.getByRole("searchbox").fill("فهد جاسم");
  await page.locator("ul li button").first().click();
  await page.getByLabel("سامي عادل الشمري", { exact: true }).check();
  await next.click();
  await page.getByRole("button", { name: "الري قسيمة 1674", exact: true }).click();
  await page.getByRole("button", { name: /^1 — / }).click();
  await next.click();
  await expect(next).toBeDisabled();
  await page.getByRole("radio", { name: "الطرف الأول", exact: true }).click();
  await expect(next).toBeDisabled();
  await page.locator("#w-notice").selectOption("0");
  await expect(next).toBeEnabled();
  await page.getByLabel("خصم مؤقت", { exact: true }).check();
  await page.locator("#discount-amount").fill("20");
  await page.locator("#discount-reason").fill("عرض مؤقت");
  await next.click();
  await expect(page.getByText("خصم شهري مؤقت", { exact: false })).toBeVisible();
  // Resuming a draft must still require explicit utilities and notice confirmation.
  await page.reload();
  await expect(next).toBeDisabled();
  await page.getByRole("radio", { name: "الطرف الأول", exact: true }).click();
  await page.locator("#w-notice").selectOption("0");
  await next.click();
  await expect(page.getByText("خصم شهري مؤقت", { exact: false })).toBeVisible();
  await next.click();
  await expect(page.locator(".contract-doc")).toContainText("المستأجرون الإضافيون");
  await expect(page.locator(".contract-doc")).toContainText("عرض مؤقت");
  await next.click();
  await page.getByRole("button", { name: "تفعيل العقد", exact: true }).click();
  await expect(page.getByRole("heading", { name: /تم تفعيل العقد/ })).toBeVisible();
  const href = await page
    .getByRole("link", { name: "فتح العقد", exact: true })
    .getAttribute("href");
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: /R-/ })).toBeVisible();
  const id = href!.split("/").pop()!;
  const db = service();
  const { data: d } = await db
    .from("contract_discounts")
    .select("amount_fils")
    .eq("contract_id", id);
  expect(d?.map((x) => x.amount_fils)).toEqual([20000]);
  await page.getByRole("button", { name: "خصم مؤقت", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("عرض مؤقت");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "فسخ العقد", exact: true }).click();
  await page.locator("#t-reason").fill("انتهاء اختبار العقد المشترك");
  await page.getByRole("button", { name: "تأكيد الفسخ", exact: true }).click();
  await expect(page.getByText("تم فسخ العقد", { exact: true })).toBeVisible();
  // Remove this test-only concession so seeded accounting totals remain independent.
  const adjustments = await db.from("adjustments").delete().eq("contract_id", id);
  expect(adjustments.error).toBeNull();
  const discounts = await db.from("contract_discounts").delete().eq("contract_id", id);
  expect(discounts.error).toBeNull();
  const cleanup = await db.from("contracts").delete().eq("id", id);
  expect(cleanup.error).toBeNull();
});

test("receipt and statement identify the full property and unit without overlapping headings", async ({
  page,
}) => {
  await login(page);
  const db = service();
  const { data: payment } = await db
    .from("payments")
    .select("id")
    .eq("org_id", org)
    .eq("voided", false)
    .limit(1)
    .single();
  await page.goto(`/print/receipt/${payment!.id}?lang=ar`);
  await expect(page.locator("header")).toContainText("الرقم الآلي");
  await expect(page.locator("header")).toContainText("شارع");
  const heading = page.getByRole("heading", { name: "سند قبض", exact: true });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  const metadata = page.locator(".num.min-w-0");
  const mb = await metadata.boundingBox();
  expect(box).not.toBeNull();
  expect(mb).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(mb!.x + mb!.width - 1);
  await page.screenshot({ path: "test-results/client-receipt.png", fullPage: true });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.goto(`/print/statement/${IDS.jabriya}/2026-08?lang=ar`);
  await expect(page.locator("section")).toContainText("12045781");
  await expect(page.getByRole("columnheader", { name: "الخصم د.ك", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/client-statement.png", fullPage: true });
});

test("staff scope can be edited and a removed member loses access", async ({ page }) => {
  await login(page);
  await page.goto("/ar/settings/users");
  const row = page.locator("div.flex.flex-wrap").filter({ hasText: "collector@demo.test" }).first();
  await row.getByRole("button", { name: "العقارات المسموح بها", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("جميع العقارات الحالية والمستقبلية", { exact: true }).uncheck();
  await sheet.getByLabel("الجابرية 157", { exact: true }).check();
  await sheet.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  const db = service();
  const { data: member } = await db
    .from("org_members")
    .select("id,property_ids")
    .eq("user_id", "0b000000-0000-4000-8000-000000000003")
    .single();
  expect(member?.property_ids).toEqual([IDS.jabriya]);
  await row.getByRole("button", { name: "إزالة المستخدم", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "تأكيد", exact: true }).click();
  await expect(page.getByText("collector@demo.test", { exact: true })).toHaveCount(0);
  // Restore the demo membership so the rest of the shared seeded suite stays independent.
  const restored = await db.from("org_members").insert({
    org_id: org,
    user_id: "0b000000-0000-4000-8000-000000000003",
    role: "collector",
    display_name: "محمد المحصل",
    email: "collector@demo.test",
    active: true,
  });
  expect(restored.error).toBeNull();
});

test("merge/split UI retains source units and permits a shared PACI", async ({ page }) => {
  const db = service();
  const { data: source, error } = await db
    .from("units")
    .insert({
      org_id: org,
      property_id: IDS.jabriya,
      label: "QA-SOURCE",
      type: "shop",
      asking_rent_fils: 300000,
      paci_no: "21643734",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  await login(page);
  await page.goto(`/ar/properties/${IDS.jabriya}?tab=units`);
  await page.getByRole("button", { name: "دمج أو فرز الوحدات", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("محل QA-SOURCE", { exact: true }).check();
  await sheet.locator("#result-label-0").fill("QA-1");
  await sheet.locator("#result-label-1").fill("QA-2");
  await sheet.locator("#result-type-0").selectOption("shop");
  await sheet.locator("#result-type-1").selectOption("shop");
  await sheet.locator("#result-rent-0").fill("150");
  await sheet.locator("#result-rent-1").fill("150");
  await sheet.locator("#restructure-paci").fill("21643734");
  await sheet.locator("#restructure-reason").fill("تقسيم المحل");
  await sheet.getByRole("button", { name: "تأكيد وحفظ الوحدات", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  const { data: old } = await db
    .from("units")
    .select("active,retired_on")
    .eq("id", source!.id)
    .single();
  expect(old?.active).toBe(false);
  expect(old?.retired_on).toBeTruthy();
  const { data: split } = await db
    .from("units")
    .select("id,paci_no")
    .eq("property_id", IDS.jabriya)
    .in("label", ["QA-1", "QA-2"]);
  expect(split).toHaveLength(2);
  expect(split?.every((u) => u.paci_no === "21643734")).toBe(true);
  await page.getByRole("button", { name: "دمج أو فرز الوحدات", exact: true }).click();
  await sheet.getByLabel("محل QA-1", { exact: true }).check();
  await sheet.getByLabel("محل QA-2", { exact: true }).check();
  await sheet.getByRole("button", { name: "إزالة هذا الصف", exact: true }).last().click();
  await sheet.locator("#result-label-0").fill("QA-MERGED");
  await sheet.locator("#result-type-0").selectOption("shop");
  await sheet.locator("#result-rent-0").fill("300");
  await sheet.locator("#restructure-reason").fill("دمج المحلين");
  await sheet.getByRole("button", { name: "تأكيد وحفظ الوحدات", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  const { data: retired } = await db
    .from("units")
    .select("active")
    .in(
      "id",
      split!.map((u) => u.id),
    );
  expect(retired?.every((u) => !u.active)).toBe(true);
  expect(
    (
      await db
        .from("units")
        .select("id")
        .eq("property_id", IDS.jabriya)
        .eq("label", "QA-MERGED")
        .eq("active", true)
    ).data,
  ).toHaveLength(1);
});

test("remove a duplicate tenant and archive one with historical contracts", async ({ page }) => {
  const db = service();
  await login(page);
  for (const historical of [false, true]) {
    const { data: tenant, error } = await db
      .from("tenants")
      .insert({
        org_id: org,
        full_name: historical ? "QA Historical tenant" : "QA Duplicate tenant",
        nationality: "كويتي",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    let contractId = "";
    if (historical) {
      const r = await db
        .from("contracts")
        .insert({
          org_id: org,
          contract_no: "QA-HISTORY",
          type: "residential",
          tenant_id: tenant!.id,
          property_id: IDS.jabriya,
          contract_date: "2025-01-01",
          start_date: "2025-01-01",
          first_collection_date: "2025-01-01",
          end_date: "2025-12-31",
          term_months: 12,
          monthly_rent_fils: 100000,
          status: "ended",
        })
        .select("id")
        .single();
      expect(r.error).toBeNull();
      contractId = r.data!.id;
    }
    await page.goto(`/ar/tenants/${tenant!.id}`);
    await page.getByRole("button", { name: "حذف أو أرشفة المستأجر", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "تأكيد", exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/tenants$/);
    const r = await db.from("tenants").select("archived_at").eq("id", tenant!.id).maybeSingle();
    if (historical) {
      expect(r.data?.archived_at).toBeTruthy();
      expect((await db.from("contracts").select("id").eq("id", contractId)).data).toHaveLength(1);
    } else expect(r.data).toBeNull();
  }
});

test("collector can post an expense but cannot edit it or save a mutable draft", async ({
  page,
}) => {
  await login(page, "collector");
  await page.goto("/ar/expenses/new");
  await expect(page.getByRole("button", { name: /حفظ.*مسودة/ })).toHaveCount(0);
  await page.getByLabel("المبلغ", { exact: true }).first().fill("1");
  await page.getByLabel("البيان", { exact: true }).first().fill("مصروف اختبار الموظف");
  await page.getByRole("button", { name: "ترحيل السند", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/expenses\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: /إلغاء.*السند/ })).toHaveCount(0);
  await expect(page.getByText("مصروف اختبار الموظف", { exact: true })).toBeVisible();
});
