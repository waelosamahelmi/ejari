/**
 * Visual review helper: screenshots routes headlessly.
 *   tsx scripts/dev/shot.ts <out-dir> <baseUrl> <route>[@mobile|@desktop][:dark] ... [--login=admin]
 */
import { chromium, type Page } from "@playwright/test";
import path from "node:path";

const [outDir = "shots", base = "http://localhost:3003", ...rest] = process.argv.slice(2);
const loginArg = rest.find((r) => r.startsWith("--login="));
const routes = rest.filter((r) => !r.startsWith("--"));

async function login(page: Page, who: string) {
  await page.goto(`${base}/ar/login`);
  await page.fill("#email", `${who}@demo.test`);
  await page.fill("#password", "Demo12345!");
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
}

(async () => {
  const browser = await chromium.launch();
  for (const spec of routes) {
    const [routePart, theme] = spec.split(":");
    const [route = "/", device = "desktop"] = routePart!.split("@");
    const mobile = device === "mobile";
    const ctx = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 2 : 1,
      colorScheme: theme === "dark" ? "dark" : "light",
      isMobile: mobile,
      hasTouch: mobile,
    });
    await ctx.addCookies([{ name: "ijari-onboarded", value: "1", url: base }, { name: "ijari-theme", value: theme === "dark" ? "dark" : "light", url: base }]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    if (loginArg) await login(page, loginArg.split("=")[1]!);
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const file = path.join(outDir, `${route.replace(/[/?=&]/g, "_")}-${device}${theme ? "-" + theme : ""}.png`);
    await page.screenshot({ path: file, fullPage: !mobile });
    console.log(file, errors.length ? `ERRORS: ${errors.slice(0, 5).join(" | ")}` : "");
    await ctx.close();
  }
  await browser.close();
})();
