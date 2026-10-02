import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { supabaseUp } from "./helpers";

config({ path: ".env.local" });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const problems = r.violations.map(
    (v) => `${label} [${v.id}] ${v.help}\n${v.nodes.slice(0, 3).map((n) => `    ${n.target.join(" ")}`).join("\n")}`,
  );
  expect(problems, problems.join("\n")).toEqual([]);
}

test.describe("signup, first-run wizard, tour & checklist", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "Supabase is not running (supabase start) — e2e skipped");
  });

  test("a new office registers, sets up, takes the tour and signs back in", async ({ page }) => {
    test.setTimeout(300_000);
    const email = `signup+${Date.now()}@demo.test`;
    const password = "Demo12345";

    // 1) Signup form + client validation.
    await page.goto("/ar/signup");
    await axe(page, "/ar/signup");
    await page.fill("#su-name", "مكتب البداية");
    await page.fill("#su-email", email);
    await page.fill("#su-password", "abc");
    await page.fill("#su-confirm", "abc");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /إنشاء الحساب/ }).click();
    await expect(page.getByText(/8 أحرف|8 characters/)).toBeVisible();
    await page.fill("#su-password", password);
    await page.fill("#su-confirm", password);
    await page.getByRole("button", { name: /إنشاء الحساب/ }).click();

    // 2) First-run wizard.
    await page.waitForURL(/\/ar\/setup/, { timeout: 30_000 });
    await axe(page, "/ar/setup step 1");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.fill("#s-name", "مكتب البداية العقاري");
    await axe(page, "/ar/setup step 2");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    await page.fill("#p-name", "الجابرية 157");
    await page.fill("#p-area", "الجابرية");
    await page.fill("#p-rent", "300");
    await axe(page, "/ar/setup step 4");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: /ابدأ استخدام/ }).click();
    await page.waitForURL(/\/ar\/dashboard\?tour=1/, { timeout: 30_000 });

    // 3) The tour auto-starts and covers every step.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await axe(page, "tour step 1");
    for (let i = 0; i < 11; i++) {
      const counter = await dialog.locator("span.num").first().textContent();
      expect(counter).toContain(`${i + 1} من 11`);
      await dialog.getByRole("button", { name: /التالي|تم/ }).last().click();
      await page.waitForTimeout(2600);
    }
    await expect(dialog).not.toBeVisible();

    // 4) Completion is recorded and the tour doesn't auto-start again.
    const { data: prefs } = await svc()
      .from("user_settings")
      .select("tour_done_at")
      .not("tour_done_at", "is", null)
      .order("tour_done_at", { ascending: false })
      .limit(1);
    expect(prefs).toHaveLength(1);
    await page.goto("/ar/dashboard");
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // 5) The activation checklist reflects the real data (property + units done).
    await expect(page.getByText("لنكمل إعداد مكتبك")).toBeVisible();
    await expect(page.getByText(/3 من 7/)).toBeVisible();

    // 6) Sign out and back in with the new credentials.
    await page.context().clearCookies();
    await page.goto("/ar/login");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
