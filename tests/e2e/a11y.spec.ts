import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { IDS, login, supabaseUp } from "./helpers";

config({ path: ".env.local" });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function ids() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const [{ data: unit }, { data: tenant }, { data: contract }, { data: kase }] = await Promise.all([
    db.from("units").select("id").eq("property_id", IDS.jabriya).limit(1).single(),
    db.from("tenants").select("id").limit(1).single(),
    db.from("contracts").select("id").eq("status", "active").limit(1).single(),
    db.from("legal_cases").select("id").limit(1).single(),
  ]);
  return { unit: unit!.id, tenant: tenant!.id, contract: contract!.id, kase: kase!.id };
}

async function scan(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${url} [${v.id}] ${v.help}\n${v.nodes.slice(0, 3).map((n) => `    ${n.target.join(" ")} — ${n.failureSummary?.split("\n").slice(0, 2).join(" ")}`).join("\n")}`);
}

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  test.beforeAll(async () => {
    test.skip(!(await supabaseUp()), "Supabase is not running (start it with `npx supabase start`).");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`app screens have no violations (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: scheme });
      await page.context().addCookies([{ name: "ijari-theme", value: scheme, url: "http://localhost" }]);
      await login(page, "admin");
      const id = await ids();
      const routes = [
        "dashboard", "collections?period=2026-08", "properties", `properties/${IDS.jabriya}`, `units/${id.unit}`, "tenants", `tenants/${id.tenant}`,
        "contracts", `contracts/${id.contract}`, "contracts/new", "payments", "expenses", "expenses/new", "deposits", "reports", "reports/late",
        "reports/accounting", "legal", `legal/${id.kase}`, "owners", "settings", "settings/notifications", "settings/templates", "audit", "more",
      ];
      const problems: string[] = [];
      for (const locale of scheme === "light" ? ["ar", "en"] : ["ar"]) for (const r of routes) problems.push(...(await scan(page, `/${locale}/${r}`)));
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }

  test("public and portal screens have no violations", async ({ page }) => {
    const problems: string[] = [];
    for (const r of ["/ar/welcome", "/en/login", "/ar/login", "/ar/forgot-password", "/ar/offline", "/en/offline", "/ar/signup", "/en/signup", "/ar/privacy", "/ar/terms"]) problems.push(...(await scan(page, r)));
    await login(page, "owner");
    for (const r of ["/ar/owner", `/ar/owner/properties/${IDS.jabriya}`, "/en/owner"]) problems.push(...(await scan(page, r)));
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
