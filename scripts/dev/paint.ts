import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const state = JSON.parse(readFileSync("tests/e2e/.auth/admin.json", "utf8"));
  await ctx.addCookies([...state.cookies, { name: "ijari-onboarded", value: "1", url: "http://localhost:3003" }]);
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on("response", (r) => { if (r.request().resourceType() === "document") console.log("doc", r.status(), Date.now() - t0, r.url()); });
  await page.goto("http://localhost:3003/ar/" + (process.argv[2] ?? "dashboard"), { waitUntil: "load" });
  console.log("load", Date.now() - t0);
  await page.waitForTimeout(3000);
  console.log(await page.evaluate(() => JSON.stringify(performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]))));
  console.log(await page.evaluate(() => JSON.stringify(performance.getEntriesByType("navigation").map((n: PerformanceEntry & { responseStart?: number; responseEnd?: number; domContentLoadedEventEnd?: number }) => [Math.round(n.responseStart ?? 0), Math.round(n.responseEnd ?? 0), Math.round(n.domContentLoadedEventEnd ?? 0)]))));
  await b.close();
})();
