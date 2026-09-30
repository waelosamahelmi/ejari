import { expect, type Page } from "@playwright/test";

export const IDS = {
  jabriya: "0d000000-0000-4000-8000-000000000001",
  alRai: "0d000000-0000-4000-8000-000000000002",
  salmiya: "0d000000-0000-4000-8000-000000000004",
  alRaiShop1: "0e000000-0000-4000-8000-000000000030",
};

/** Skips the suite with a clear message when Supabase isn't reachable. */
export async function supabaseUp(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:55321";
  try {
    const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } });
    return r.ok;
  } catch {
    return false;
  }
}

export async function login(page: Page, who: "admin" | "accountant" | "collector" | "owner" = "admin", locale = "ar") {
  await page.goto(`/${locale}/login`);
  await page.fill("#email", `${who}@demo.test`);
  await page.fill("#password", "Demo12345!");
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }), page.click('button[type="submit"]')]);
}

export async function expectNoConsoleErrors(errors: string[]) {
  expect(errors.filter((e) => !/favicon|Download the React DevTools/.test(e))).toEqual([]);
}
