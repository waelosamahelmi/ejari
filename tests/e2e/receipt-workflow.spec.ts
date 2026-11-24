import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { login, supabaseUp, IDS } from "./helpers";
config({ path: ".env.local" });
const org = "0a000000-0000-4000-8000-000000000001";
const owner = "0c000000-0000-4000-8000-000000000001";
function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
function pages(file: string) {
  return Number(
    execFileSync("/opt/homebrew/bin/pdfinfo", [file], { encoding: "utf8" }).match(
      /Pages:\s+(\d+)/,
    )?.[1],
  );
}
test.beforeAll(async () => test.skip(!(await supabaseUp()), "Local Supabase required"));
test("prepared receipts print together, then collect the same discounted number without duplicate income", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const db = service();
  const name = `اختبار وصولات ${Date.now()}`;
  const p = await db.from("properties").insert({ org_id: org, name }).select("id").single();
  expect(p.error).toBeNull();
  const property = p.data!.id;
  expect(
    (
      await db
        .from("property_owners")
        .insert({ org_id: org, property_id: property, owner_id: owner, share_pct: 100 })
    ).error,
  ).toBeNull();
  const contracts: string[] = [];
  for (const label of ["1", "2"]) {
    const u = await db
      .from("units")
      .insert({ org_id: org, property_id: property, label, type: "apartment" })
      .select("id")
      .single();
    const t = await db
      .from("tenants")
      .insert({ org_id: org, full_name: `${name} ${label}` })
      .select("id")
      .single();
    expect(u.error ?? t.error).toBeNull();
    const c = await db
      .from("contracts")
      .insert({
        org_id: org,
        property_id: property,
        owner_id: owner,
        tenant_id: t.data!.id,
        contract_no: `${name}-${label}`,
        type: "residential",
        status: "active",
        contract_date: "2026-11-01",
        start_date: "2026-11-01",
        first_collection_date: "2026-11-01",
        end_date: "2027-10-31",
        term_months: 12,
        monthly_rent_fils: 300000,
      })
      .select("id")
      .single();
    expect(c.error).toBeNull();
    contracts.push(c.data!.id);
    expect(
      (
        await db.from("contract_units").insert({
          org_id: org,
          contract_id: c.data!.id,
          unit_id: u.data!.id,
          rent_share_fils: 300000,
        })
      ).error,
    ).toBeNull();
    const charge = await db
      .from("charges")
      .insert({
        org_id: org,
        contract_id: c.data!.id,
        period: "2026-11",
        kind: "rent",
        amount_fils: 300000,
        due_date: "2026-11-01",
      })
      .select("id")
      .single();
    expect(charge.error).toBeNull();
    expect(
      (
        await db.from("adjustments").insert({
          org_id: org,
          contract_id: c.data!.id,
          charge_id: charge.data!.id,
          kind: "discount",
          amount_fils: 50000,
          adjustment_date: "2026-11-01",
          reason: "خصم معتمد",
        })
      ).error,
    ).toBeNull();
  }
  await login(page);
  await page.goto(`/ar/collections/receipts?period=2026-11&property=${property}`);
  await page.getByRole("button", { name: "اختيار الكل", exact: true }).click();
  await page.getByRole("button", { name: "تجهيز الوصلات المختارة", exact: true }).click();
  await expect(page.getByText("بانتظار التحصيل", { exact: false })).toHaveCount(2);
  const r = await db
    .from("collection_receipts")
    .select("*")
    .in("contract_id", contracts)
    .order("document_no");
  expect(r.error).toBeNull();
  expect(r.data).toHaveLength(2);
  expect(r.data!.map((x) => x.amount_fils)).toEqual([250000, 250000]);
  expect((await db.from("payments").select("id").in("contract_id", contracts)).data).toHaveLength(
    0,
  );
  await context.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "طباعة الكل (حتى 100)", exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.locator(".prepared-receipt")).toHaveCount(2);
  await popup.getByRole("button", { name: "طباعة", exact: true }).click();
  await expect(popup.locator("body")).toHaveAttribute("data-printed", "yes");
  const pdf = test.info().outputPath("prepared-receipts-a4.pdf");
  await popup.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  expect(pages(pdf)).toBe(1);
  await expect
    .poll(
      async () =>
        (await db.from("document_prints").select("id").eq("document_id", r.data![0]!.id)).data
          ?.length,
    )
    .toBeGreaterThan(0);
  await popup.close();
  await page.getByRole("button", { name: "تم التحصيل — سجّل الدفعة", exact: true }).first().click();
  await expect(page.locator("#p-amount")).toBeDisabled();
  await expect(page.locator("#p-receipt")).toHaveAttribute("readonly", "");
  const no = await page.locator("#p-receipt").inputValue();
  await page.getByRole("button", { name: /حفظ الدفعة/ }).click();
  await expect
    .poll(
      async () =>
        (await db.from("payments").select("receipt_no,amount_fils").in("contract_id", contracts))
          .data,
    )
    .toEqual([{ receipt_no: no, amount_fils: 250000 }]);
  await page.goto(
    `/ar/reports/uncollected-receipts?from=2026-11&to=2026-11&property=${property}&dateFrom=2026-11-01&dateTo=2026-11-30`,
  );
  await expect(page.locator("main")).toContainText("250.000");
  await page.goto(`/ar/reports/property-contracts?from=2026-11&to=2026-11&property=${property}`);
  await expect(page.locator("main")).toContainText("300.000");
  await expect(page.locator("main")).toContainText("31/10/2027");
});

test("29-unit statement fills one A4 page with one totals row", async ({ page }) => {
  await login(page);
  await page.goto(`/print/statement/${IDS.jabriya}/2026-08?lang=ar`);
  await expect(page.locator("tbody tr")).toHaveCount(27);
  await page.evaluate(() => document.fonts.ready);
  const file = test.info().outputPath("statement-29-units-a4.pdf");
  await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  expect(pages(file)).toBe(1);
  await expect(page.locator("tfoot tr")).toHaveCount(1);
  await expect(page.locator("tfoot")).toContainText("8,960.000");
});

test("paid receipts batch and voucher notes print with tracked requests", async ({ page }) => {
  const db = service();
  const seedPayments = await db
    .from("payments")
    .select("id")
    .eq("org_id", org)
    .eq("voided", false)
    .order("received_at")
    .limit(2);
  expect(seedPayments.data).toHaveLength(2);
  await login(page);
  await page.goto(
    `/print/receipt-batch?ids=${seedPayments.data!.map((p) => p.id).join(",")}&lang=ar`,
  );
  await expect(page.locator(".receipt-slot")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  const batch = test.info().outputPath("paid-receipts-a4.pdf");
  await page.pdf({ path: batch, preferCSSPageSize: true, printBackground: true });
  expect(pages(batch)).toBe(1);
  // A single receipt sits in the top half of one A4 page; the A5 layout gives each receipt its own page.
  await page.goto(`/print/receipt/${seedPayments.data![0]!.id}?lang=ar`);
  await page.evaluate(() => document.fonts.ready);
  const single = test.info().outputPath("single-receipt-a4.pdf");
  await page.pdf({ path: single, preferCSSPageSize: true, printBackground: true });
  expect(pages(single)).toBe(1);
  await page.goto(
    `/print/receipt-batch?ids=${seedPayments.data!.map((p) => p.id).join(",")}&lang=ar&layout=a5`,
  );
  await page.evaluate(() => document.fonts.ready);
  const a5 = test.info().outputPath("paid-receipts-a5.pdf");
  await page.pdf({ path: a5, preferCSSPageSize: true, printBackground: true });
  expect(pages(a5)).toBe(2);
  await page.goto("/ar/expenses/new");
  await page.getByRole("button", { name: "الجابرية 157", exact: true }).click();
  await page.getByLabel("المبلغ").first().fill("10");
  await page.getByLabel("البيان").first().fill("صيانة اختبار طباعة");
  await page.locator("#v-notes").fill("ملاحظة السند مطبوعة\nتفاصيل إضافية للمستلم");
  await page.getByRole("button", { name: "ترحيل السند", exact: true }).click();
  await expect(page).toHaveURL(/\/ar\/expenses\/[0-9a-f-]{36}$/);
  const voucherId = page.url().split("/").at(-1)!;
  const v = await db
    .from("expense_vouchers")
    .select("owner_id,voucher_no")
    .eq("id", voucherId)
    .single();
  expect(v.data?.owner_id).toBe(owner);
  expect(v.data?.voucher_no).toMatch(/^EX-2026-\d{5}$/);
  await page.goto(`/print/voucher/${voucherId}?lang=ar`);
  await expect(page.locator(".print-page")).toContainText("ملاحظة السند مطبوعة");
  await expect(page.locator(".print-page")).toContainText("تفاصيل إضافية للمستلم");
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "طباعة", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await expect
    .poll(
      async () =>
        (await db.from("document_prints").select("id").eq("document_id", voucherId)).data?.length,
    )
    .toBe(1);
  const file = test.info().outputPath("voucher-notes-a4.pdf");
  await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  expect(pages(file)).toBe(1);
  await page.goto("/ar/reports/expense-ledger?from=2026-11&to=2026-11");
  await expect(page.locator("main")).toContainText("ملاحظة السند مطبوعة");
});
