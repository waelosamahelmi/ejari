import { chromium, type FullConfig } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { supabaseUp, waitForSupabase } from "./helpers";

config({ path: ".env.local" });

export const AUTH_DIR = "tests/e2e/.auth";
const ROLES = ["admin", "accountant", "collector", "owner"] as const;

/**
 * Re-seeds the local database so specs start from a known state (the suite mutates payments,
 * contracts and vouchers). Only for local Supabase; set E2E_NO_RESET=1 to skip.
 */
async function resetLocalDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const local = url.includes("127.0.0.1") || url.includes("localhost");
  if (!local || process.env.E2E_NO_RESET === "1" || !(await supabaseUp())) return;
  execSync("npx supabase db reset", { stdio: "ignore", timeout: 240_000 });
  await waitForSupabase();
}

/**
 * Signs each demo role in once and saves its session, so specs reuse it instead of
 * hitting the login rate limiter (6 attempts per email per minute) on every test.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  await mkdir(AUTH_DIR, { recursive: true });
  await resetLocalDb();
  const browser = await chromium.launch();
  try {
    for (const role of ROLES) {
      const ctx = await browser.newContext({ baseURL });
      await ctx.addCookies([{ name: "ijari-onboarded", value: "1", url: baseURL }]);
      const page = await ctx.newPage();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto("/ar/login");
          await page.fill("#email", `${role}@demo.test`);
          await page.fill("#password", "Demo12345!");
          await Promise.all([
            page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 }),
            page.click('button[type="submit"]'),
          ]);
          await ctx.storageState({ path: `${AUTH_DIR}/${role}.json` });
          break;
        } catch {
          // Supabase not running: specs skip themselves via supabaseUp().
          // Auth still warming up after a db reset: wait and retry.
          if (!(await supabaseUp())) break;
          await waitForSupabase(15_000);
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}
