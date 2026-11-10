import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { login, supabaseUp } from "./helpers";
config({ path: ".env.local" });
test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async () => test.skip(!(await supabaseUp()), "Local Supabase required"));

test("two shops merge into one prefilled plot without an unseen blank result row", async ({
  page,
}) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const org = "0a000000-0000-4000-8000-000000000001";
  const p = await db
    .from("properties")
    .insert({ org_id: org, name: "Merge QA" })
    .select("id")
    .single();
  expect(p.error).toBeNull();
  const source = await db
    .from("units")
    .insert(
      ["11", "12"].map((label) => ({
        org_id: org,
        property_id: p.data!.id,
        label,
        type: "shop",
        floor: 1,
        asking_rent_fils: 650000,
      })),
    )
    .select("id");
  expect(source.error).toBeNull();
  await login(page);
  await page.goto(`/en/properties/${p.data!.id}?tab=units`);
  await page.getByRole("button", { name: "Merge or split units", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Shop 11", { exact: true }).check();
  await sheet.getByLabel("Shop 12", { exact: true }).check();
  await expect(sheet.locator("#result-label-0")).toHaveValue("11+12");
  await expect(sheet.locator("#result-label-1")).toHaveCount(0);
  await expect(sheet.locator("#result-type-0")).toHaveValue("shop");
  await expect(sheet.locator("#result-rent-0")).toHaveValue("1,300.000");
  await expect(sheet.locator("#result-floor-0")).toHaveValue("1");
  const confirm = sheet.getByRole("button", { name: "Confirm and save units", exact: true });
  await expect(confirm).toBeDisabled();
  await expect(sheet.getByRole("status")).toContainText(
    "Enter the reason for merging or splitting to save.",
  );
  await sheet.locator("#result-type-0").selectOption("plot");
  await sheet.locator("#restructure-reason").fill("Merge shops into a plot");
  await expect(confirm).toBeEnabled();
  await sheet.locator("#result-type-0").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/unit-merge-mobile.png", fullPage: true });
  await confirm.click();
  await expect(sheet).not.toBeVisible();
  const result = await db
    .from("units")
    .select("label,type,floor,asking_rent_fils")
    .eq("property_id", p.data!.id)
    .eq("active", true);
  expect(result.data).toEqual([
    { label: "11+12", type: "plot", floor: 1, asking_rent_fils: 1300000 },
  ]);
  const retired = await db
    .from("units")
    .select("active,retired_on")
    .in(
      "id",
      source.data!.map((u) => u.id),
    );
  expect(retired.data?.every((u) => !u.active && u.retired_on)).toBe(true);
  const history = await db
    .from("unit_restructures")
    .select("source_ids,reason")
    .eq("property_id", p.data!.id)
    .single();
  expect(history.data?.source_ids).toHaveLength(2);
  expect(history.data?.reason).toBe("Merge shops into a plot");
});
