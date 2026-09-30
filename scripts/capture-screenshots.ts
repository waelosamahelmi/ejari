/**
 * Captures the PWA manifest screenshots (§19.1) from seeded data, in Arabic.
 *   pnpm dev -p 3003 & pnpm tsx scripts/capture-screenshots.ts http://localhost:3003
 * Writes public/screenshots/{narrow,wide}-*.png (sizes referenced in app/manifest.ts).
 */
import { chromium, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3003";
const OUT = "public/screenshots";

const SHOTS = [
  { file: "narrow-dashboard", route: "/ar/dashboard", narrow: true },
  { file: "narrow-collections", route: "/ar/collections?period=2026-08", narrow: true },
  { file: "narrow-property", route: "/ar/properties", narrow: true, clickFirstCard: true },
  { file: "wide-dashboard", route: "/ar/dashboard", narrow: false },
  { file: "wide-collections", route: "/ar/collections?period=2026-08", narrow: false },
];

async function login(page: Page) {
  await page.goto(`${base}/ar/login`);
  await page.fill("#email", "admin@demo.test");
  await page.fill("#password", "Demo12345!");
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 60000 }), page.click('button[type="submit"]')]);
}

(async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const s of SHOTS) {
    const ctx = await browser.newContext({
      viewport: s.narrow ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      isMobile: s.narrow,
      hasTouch: s.narrow,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    await ctx.addCookies([{ name: "ijari-onboarded", value: "1", url: base }, { name: "ijari-theme", value: "light", url: base }]);
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${base}${s.route}`, { waitUntil: "networkidle" });
    if (s.clickFirstCard) {
      await page.locator('a[href*="/properties/"]').first().click();
      await page.waitForLoadState("networkidle");
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${s.file}.png` });
    console.log(`${OUT}/${s.file}.png`);
    await ctx.close();
  }
  await browser.close();
})();
