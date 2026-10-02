import { existsSync, readFileSync } from "node:fs";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const IDS = {
  jabriya: "0d000000-0000-4000-8000-000000000001",
  alRai: "0d000000-0000-4000-8000-000000000002",
  salmiya: "0d000000-0000-4000-8000-000000000004",
  alRaiShop1: "0e000000-0000-4000-8000-000000000030",
};

export type Role = "admin" | "accountant" | "collector" | "owner";

/** One real sign-in for a demo role, saved so specs can reuse the session. */
export async function signInAndSave(browser: Browser, who: Role, baseURL: string) {
  const ctx = await browser.newContext({ baseURL });
  await ctx.addCookies([{ name: "ijari-onboarded", value: "1", url: baseURL }]);
  const page = await ctx.newPage();
  await page.goto("/ar/login");
  await page.fill("#email", `${who}@demo.test`);
  await page.fill("#password", "Demo12345!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]'),
  ]);
  await ctx.storageState({ path: `tests/e2e/.auth/${who}.json` });
  await ctx.close();
}

/** Skips the suite with a clear message when Supabase isn't reachable. */
export async function supabaseUp(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
  try {
    const r = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Waits for Supabase Auth to be healthy again (services restart after `supabase db reset`). */
export async function waitForSupabase(timeoutMs = 60_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await supabaseUp()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export async function login(page: Page, who: Role = "admin", locale = "ar") {
  // Reuse the session saved by global-setup (one real sign-in per role per run).
  const file = `tests/e2e/.auth/${who}.json`;
  if (existsSync(file)) {
    const state = JSON.parse(readFileSync(file, "utf8")) as { cookies: Parameters<BrowserContext["addCookies"]>[0] };
    await page.context().addCookies(state.cookies);
    await page.goto(`/${locale}/${who === "owner" ? "owner" : "dashboard"}`);
    // The middleware redirect to /login can be client-side; wait briefly for either surface.
    await Promise.race([
      page.locator("#email").waitFor({ state: "visible", timeout: 8000 }).catch(() => {}),
      page.locator("main").waitFor({ state: "visible", timeout: 8000 }).catch(() => {}),
    ]);
    if (!(await page.locator("#email").isVisible().catch(() => false))) return;
  }
  await page.goto(`/${locale}/login`);
  await page.fill("#email", `${who}@demo.test`);
  await page.fill("#password", "Demo12345!");
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }), page.click('button[type="submit"]')]);
}

export async function expectNoConsoleErrors(errors: string[]) {
  expect(errors.filter((e) => !/favicon|Download the React DevTools/.test(e))).toEqual([]);
}
