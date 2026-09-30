import { chromium, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";

export const AUTH_DIR = "tests/e2e/.auth";
const ROLES = ["admin", "accountant", "collector", "owner"] as const;

/**
 * Signs each demo role in once and saves its session, so specs reuse it instead of
 * hitting the login rate limiter (6 attempts per email per minute) on every test.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  await mkdir(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const role of ROLES) {
      const ctx = await browser.newContext({ baseURL });
      await ctx.addCookies([{ name: "ijari-onboarded", value: "1", url: baseURL }]);
      const page = await ctx.newPage();
      try {
        await page.goto("/ar/login");
        await page.fill("#email", `${role}@demo.test`);
        await page.fill("#password", "Demo12345!");
        await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }), page.click('button[type="submit"]')]);
        await ctx.storageState({ path: `${AUTH_DIR}/${role}.json` });
      } catch {
        // Supabase not running: specs skip themselves via supabaseUp().
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}
