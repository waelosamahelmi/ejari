import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { test, expect } from "@playwright/test";
import { login, supabaseUp } from "./helpers";

config({ path: ".env.local" });

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
    await expect(page.getByRole("heading", { name: /تم تفعيل العقد I-\d{4}-\d{4}/ })).toBeVisible({
      timeout: 20_000,
    });
    const open = page.getByRole("link", { name: "فتح العقد" });
    const href = await open.getAttribute("href");
    const id = href!.split("/").pop()!;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
    const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    // Reproduce the legacy blank-owner snapshot while the property has a linked owner.
    const { data: snapshot, error: snapshotError } = await db
      .from("contracts")
      .select("rendered_clauses")
      .eq("id", id)
      .single();
    expect(snapshotError).toBeNull();
    const legacy = snapshot!.rendered_clauses;
    legacy.preamble = legacy.preamble.map((line: string) =>
      line.startsWith("الطرف الأول:")
        ? "الطرف الأول: ، المالك"
        : line.startsWith("ويحمل بطاقة مدنية رقم:")
          ? "ويحمل بطاقة مدنية رقم:"
          : line,
    );
    delete legacy.preambleParts;
    for (const clause of legacy.clauses) delete clause.parts;
    const { error: legacyError } = await db
      .from("contracts")
      .update({ rendered_clauses: legacy, owner_id: null })
      .eq("id", id);
    expect(legacyError).toBeNull();
    await page.goto(`/print/contract/${id}?lang=ar`);
    await expect(page.getByRole("heading", { name: "عقد إيجار" })).toBeVisible();
    await expect(page.getByText(/خمسمائة وخمسون/)).toBeVisible();
    await expect(page.locator(".contract-doc img")).toHaveCount(0);
    await expect(page.locator(".contract-field").filter({ hasText: "550.000" })).toHaveCSS(
      "color",
      "rgb(198, 40, 40)",
    );
    await expect(page.locator(".contract-doc")).toContainText(
      "الطرف الأول: عبدالعزيز محمد الصالح، المالك",
    );
    await expect(page.locator(".contract-doc")).toContainText("277040679195");
    await expect(page.locator(".signature")).toContainText("الاسم:");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".contract-field").first()).toHaveCSS("color", "rgb(198, 40, 40)");
    await page.emulateMedia({ media: "screen" });
    await page.screenshot({ path: "test-results/client-contract-print.png", fullPage: true });
    // Match the client's case: a contract with its current charges fully paid.
    const { data: contract, error: contractError } = await db
      .from("contracts")
      .select("org_id, tenant_id, start_date")
      .eq("id", id)
      .single();
    expect(contractError).toBeNull();
    const { data: charges, error: chargeError } = await db
      .from("charges")
      .select("id, amount_fils")
      .eq("contract_id", id)
      .eq("voided", false)
      .lte("period", contract!.start_date.slice(0, 7));
    expect(chargeError).toBeNull();
    expect(charges!.length).toBeGreaterThan(0);
    const { data: payment, error: paymentError } = await db
      .from("payments")
      .insert({
        org_id: contract!.org_id,
        tenant_id: contract!.tenant_id,
        contract_id: id,
        amount_fils: charges!.reduce((n, c) => n + c.amount_fils, 0),
        method: "cash",
        received_at: contract!.start_date,
        receipt_no: `termination-${id}`,
      })
      .select("id")
      .single();
    expect(paymentError).toBeNull();
    const { error: allocationError } = await db.from("payment_allocations").insert(
      charges!.map((c) => ({
        org_id: contract!.org_id,
        payment_id: payment!.id,
        charge_id: c.id,
        amount_fils: c.amount_fils,
      })),
    );
    expect(allocationError).toBeNull();
    await page.goto(`/en/contracts/${id}`);
    await page.getByRole("button", { name: "Terminate", exact: true }).click();
    await expect(
      page.getByText("Enter a reason to enable confirmation.", { exact: false }),
    ).toBeVisible();
    const confirm = page.getByRole("button", { name: "Confirm termination" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Reason (required)").fill("Tenant requested to vacate");
    await expect(confirm).toBeEnabled();
    await expect(page.getByRole("dialog")).toContainText("0.000 KWD");
    await confirm.click();
    await expect(page.getByText("Contract terminated", { exact: true })).toBeVisible();
  });
});
