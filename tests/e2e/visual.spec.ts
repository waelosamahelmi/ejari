/**
 * Visual regression baselines (§20): the key screens in ar/en × light/dark × 390px/1440px.
 *
 * Determinism: the local database is re-seeded before the run, notifications are inserted with
 * fixed timestamps, all flows use seeded data and fixed dates, and widgets that depend on
 * "today" are masked via [data-shot-mask]. Create/refresh baselines with:
 *   pnpm test:e2e tests/e2e/visual.spec.ts --update-snapshots
 */
import { test, expect, devices, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { IDS, signInAndSave, supabaseUp, waitForSupabase, type Role } from "./helpers";

config({ path: ".env.local" });

const PORT = Number(process.env.PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const ADMIN_STATE = "tests/e2e/.auth/admin.json";

const VIEWPORTS = [
  { name: "m", viewport: { width: 390, height: 844 }, isMobile: true },
  { name: "d", viewport: { width: 1440, height: 900 }, isMobile: false },
] as const;

type ViewportSpec = (typeof VIEWPORTS)[number];
type Ids = { unit: string; residential: string; investment: string; voucher: string };

let ids: Ids;

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function reseed() {
  execSync("npx supabase db reset", { stdio: "ignore", timeout: 240_000 });
  await waitForSupabase();
  const sb = svc();
  // PostgREST may still be reloading its schema cache right after the reset.
  let member: { org_id: string; user_id: string } | null = null;
  for (let i = 0; i < 30 && !member; i++) {
    const { data } = await sb.from("org_members").select("org_id, user_id").eq("role", "admin").limit(1).maybeSingle();
    member = data;
    if (!member) await new Promise((r) => setTimeout(r, 1000));
  }
  if (!member) throw new Error("seed: no admin member");
  const { error } = await sb.from("notifications").insert([
    {
      org_id: member.org_id,
      user_id: member.user_id,
      type: "payment_recorded",
      title_ar: "تم تحصيل ٣٠٠٫٠٠٠ د.ك",
      title_en: "300.000 KWD collected",
      body_ar: "الجابرية ١٥٧، وحدة ٥. بواسطة محمد.",
      body_en: "Jabriya 157, unit 5. By Mohammed.",
      url: "/collections?period=2026-08",
      read_at: "2026-08-28T10:30:00+03:00",
      created_at: "2026-08-28T09:15:00+03:00",
      dedupe_key: "visual-payment",
    },
    {
      org_id: member.org_id,
      user_id: member.user_id,
      type: "tenant_late",
      title_ar: "متأخرات ٢٠٫٠٠٠ د.ك — وحدة تسعة",
      title_en: "20.000 KWD overdue — unit 9",
      body_ar: "الجابرية ١٥٧. آخر سداد ١٢ أغسطس ٢٠٢٦.",
      body_en: "Jabriya 157. Last payment 12 Aug 2026.",
      url: "/reports/late",
      created_at: "2026-09-05T08:00:00+03:00",
      dedupe_key: "visual-late",
    },
    {
      org_id: member.org_id,
      user_id: member.user_id,
      type: "contract_expiring",
      title_ar: "عقد ينتهي خلال ٤٥ يومًا",
      title_en: "Contract expires in 45 days",
      body_ar: "صباح السالم قطعة ١٢ — العقد R-2026-0001.",
      body_en: "Sabah Al-Salem block 12 — contract R-2026-0001.",
      url: "/contracts",
      created_at: "2026-09-12T11:45:00+03:00",
      dedupe_key: "visual-expiring",
    },
  ]);
  if (error) throw new Error(`seed notifications: ${error.message}`);

  const [{ data: unit }, { data: res }, { data: inv }, { data: voucher }] = await Promise.all([
    sb.from("contract_units").select("unit_id, contracts!inner(status)").eq("contracts.status", "active").limit(1).single(),
    sb.from("contracts").select("id").eq("type", "residential").limit(1).single(),
    sb.from("contracts").select("id").eq("type", "investment").limit(1).single(),
    sb.from("expense_vouchers").select("id").limit(1).single(),
  ]);
  if (!unit || !res || !inv || !voucher) throw new Error("seed ids missing");
  ids = { unit: unit.unit_id, residential: res.id, investment: inv.id, voucher: voucher.id };
}

async function freshSessions(browser: Browser) {
  // After the reseed the previously saved sessions are invalid, and spec order is not guaranteed,
  // so refresh every role's session for whatever runs next.
  for (const role of ["admin", "accountant", "collector", "owner"] as Role[]) {
    await signInAndSave(browser, role, BASE);
  }
}

async function newContext(
  browser: Browser,
  scheme: "light" | "dark",
  locale: "ar" | "en",
  vp: ViewportSpec,
  opts: { auth?: boolean; userAgent?: string } = {},
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: vp.viewport,
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    colorScheme: scheme,
    reducedMotion: "reduce",
    locale: locale === "ar" ? "ar-KW" : "en-GB",
    storageState: opts.auth ? ADMIN_STATE : undefined,
    userAgent: opts.userAgent,
  });
  await ctx.addCookies([
    { name: "ijari-theme", value: scheme, url: BASE },
    { name: "ijari-onboarded", value: "1", url: BASE },
  ]);
  return ctx;
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean; extraMask?: Locator[] } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});
  await page.waitForTimeout(250);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: opts.fullPage ?? false,
    mask: [page.locator("[data-shot-mask]"), ...(opts.extraMask ?? [])],
  });
}

async function captureAll(
  page: Page,
  browser: Browser,
  locale: "ar" | "en",
  scheme: "light" | "dark",
  vp: ViewportSpec,
) {
  const ar = locale === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const pre = `${vp.name}-${locale}-${scheme}`;
  const next = page.getByRole("button", { name: t("التالي", "Next"), exact: true });

  // Dashboard (period pinned to the seeded August) → notifications → connectivity pill.
  await page.goto(`/${locale}/dashboard?period=2026-08`);
  await shot(page, `${pre}-dashboard`);

  await page.getByRole("button", { name: new RegExp(t("الإشعارات", "Notifications")) }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, `${pre}-notifications`);
  await page.keyboard.press("Escape");

  await page.context().setOffline(true);
  await expect(page.getByText(new RegExp(`${t("غير متصل", "offline")}`, "i"))).toBeVisible();
  await shot(page, `${pre}-offline-pill`);
  await page.context().setOffline(false);

  // Collections + record-payment sheet.
  await page.goto(`/${locale}/collections?period=2026-08`);
  await shot(page, `${pre}-collections`);

  if (vp.isMobile) await page.locator('button[class*="min-h-[76px]"]').first().click();
  else await page.locator("tbody tr:has(td)").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.locator("#p-amount").fill("300");
  await sheet.locator("#p-date").fill("25/08/2026");
  await sheet.locator("#p-receipt").fill("41230");
  await shot(page, `${pre}-payment-sheet`);
  await page.keyboard.press("Escape");

  // Property (hero) + Building Stack.
  await page.goto(`/${locale}/properties/${IDS.jabriya}`);
  await shot(page, `${pre}-property`);
  await page.goto(`/${locale}/properties/${IDS.jabriya}?tab=units`);
  await shot(page, `${pre}-building-stack`);

  // Unit detail.
  await page.goto(`/${locale}/units/${ids.unit}`);
  await shot(page, `${pre}-unit`);

  // Contract wizard: type → … → terms (4) → … → review (6).
  await page.goto(`/${locale}/contracts/new`);
  await shot(page, `${pre}-wizard-1`);
  await page.getByRole("button", { name: t("استثماري", "Investment") }).click();
  await next.click();
  await page.getByRole("searchbox").fill("الشمري");
  await page.locator("ul li button").first().click();
  await next.click();
  await page.getByRole("button", { name: /الري قسيمة 1674|Al-Rai Plot 1674/ }).click();
  await page.getByRole("button", { name: /^1 — / }).click();
  await next.click();
  await page.locator("#w-cdate").fill("01/10/2026");
  await page.locator("#w-start").fill("01/10/2026");
  await page.locator("#w-first").fill("01/12/2026");
  await expect(page.locator("#w-first")).toHaveValue("01/12/2026");
  await shot(page, `${pre}-wizard-4`);
  await next.click();
  await next.click();
  await expect(page.getByText(t("أول الاستحقاقات", "First charges"))).toBeVisible();
  await shot(page, `${pre}-wizard-6`);

  // Late units report, pinned to 31/08/2026.
  await page.goto(`/${locale}/reports/late?preset=custom&from=2026-08&to=2026-08&asOf=2026-08-31`);
  await shot(page, `${pre}-late-units`);

  // Print routes.
  await page.goto(`/print/contract/${ids.residential}?lang=${locale}`);
  await shot(page, `${pre}-contract-print-residential`, { fullPage: true });
  await page.goto(`/print/contract/${ids.investment}?lang=${locale}`);
  await shot(page, `${pre}-contract-print-investment`, { fullPage: true });
  await page.goto(`/print/voucher/${ids.voucher}?lang=${locale}`);
  await shot(page, `${pre}-voucher-print`, { fullPage: true });
  await page.goto(`/print/statement/${IDS.jabriya}/2026-08?lang=${locale}`);
  await shot(page, `${pre}-statement-print`, { fullPage: true });

  // Settings → Install, then the iOS guide sheet (iPhone user agent).
  await page.goto(`/${locale}/settings/install`);
  await shot(page, `${pre}-install`);

  const iosCtx = await newContext(browser, scheme, locale, vp, {
    auth: true,
    userAgent: devices["iPhone 13"].userAgent,
  });
  const ios = await iosCtx.newPage();
  await ios.goto(`/${locale}/settings/install`);
  await ios.getByRole("button", { name: t("اعرض الخطوات", "Show me how") }).click();
  await expect(ios.getByRole("dialog")).toBeVisible();
  await shot(ios, `${pre}-ios-install-guide`);
  await iosCtx.close();
}

test.describe("visual regression (§20)", () => {
  test.beforeAll(async ({ browser }) => {
    test.skip(!(await supabaseUp()), "Supabase is not running (supabase start) — e2e skipped");
    await reseed();
    await freshSessions(browser);
  });

  for (const locale of ["ar", "en"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${locale} · ${scheme}`, async ({ browser }) => {
        test.setTimeout(900_000);
        // Logged-out screens first, then the app with the admin session.
        for (const vp of VIEWPORTS) {
          const pre = `${vp.name}-${locale}-${scheme}`;
          const ctx = await newContext(browser, scheme, locale, vp);
          const page = await ctx.newPage();
          await page.goto(`/${locale}/welcome`);
          await shot(page, `${pre}-onboarding`);
          await page.goto(`/${locale}/login`);
          await shot(page, `${pre}-login`);
          await ctx.close();

          const appCtx = await newContext(browser, scheme, locale, vp, { auth: true });
          const app = await appCtx.newPage();
          await captureAll(app, browser, locale, scheme, vp);
          await appCtx.close();
        }
      });
    }
  }
});
