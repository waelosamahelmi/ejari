import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { periodOf, todayKuwait } from "../../src/domain/dates";
import { login, supabaseUp } from "./helpers";

config({ path: ".env.local" });

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => !!navigator.serviceWorker, null, { timeout: 30_000 });
  // The first visit activates the SW; a second navigation is controlled (clients.claim may
  // race the first paint), so reload once when the page isn't controlled yet.
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, {
    timeout: 30_000,
  });
}

// New headless Chromium: the legacy headless shell denies notification permission.
test.use({ channel: "chromium" });

test.describe("PWA", () => {
  test.beforeAll(async () => {
    test.skip(
      !(await supabaseUp()),
      "Supabase is not running (start it with `npx supabase start`).",
    );
  });

  test("manifest is installable and bilingual-aware", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = (await res.json()) as Record<string, unknown> & {
      icons: { purpose: string; sizes: string }[];
      shortcuts: unknown[];
      screenshots: { form_factor: string; src: string }[];
    };
    expect(m).toMatchObject({
      name: "إيجاري | Ejari",
      short_name: "إيجاري",
      lang: "ar",
      dir: "rtl",
      display: "standalone",
      start_url: "/ar/dashboard?source=pwa",
      id: "/",
    });
    expect(m.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
    expect(m.icons.some((i) => i.purpose === "any" && i.sizes === "192x192")).toBe(true);
    expect(m.shortcuts).toHaveLength(4);
    expect(m.screenshots.filter((s) => s.form_factor === "narrow")).toHaveLength(3);
    for (const s of m.screenshots) expect((await request.get(s.src)).ok()).toBe(true);
    expect((await request.get("/sw.js")).ok()).toBe(true);
  });

  test("Chrome reports the app as installable (no installability errors)", async ({ page, context }) => {
    await login(page, "admin");
    await waitForServiceWorker(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: { errorId: string }[] };
    // Playwright contexts are incognito profiles, which Chrome never offers to install from.
    expect(installabilityErrors.filter((e) => e.errorId !== "in-incognito")).toEqual([]);
    const { url, errors } = (await cdp.send("Page.getAppManifest")) as { url: string; errors: unknown[] };
    expect(url).toContain("/manifest.webmanifest");
    expect(errors).toEqual([]);
  });

  test("offline: collections open from cache, a payment queues and syncs exactly once", async ({
    page,
    context,
  }) => {
    const db = admin();
    // The collections page embeds offline payment contexts only for the current month (§19.3),
    // so target a contract with rent still outstanding as of today and open that month.
    const period = periodOf(todayKuwait());
    const { data: open } = await db
      .from("v_charge_balances")
      .select("contract_id, period, outstanding_fils")
      .eq("kind", "rent")
      .gt("outstanding_fils", 0)
      .lte("period", period)
      .limit(20);
    let target: { contractId: string; propertyId: string; tenant: string } | null = null;
    for (const o of open ?? []) {
      const { data: c } = await db
        .from("contracts")
        .select("id, status, property_id, tenants(full_name)")
        .eq("id", o.contract_id!)
        .single();
      if (c && c.status === "active") {
        target = {
          contractId: c.id,
          propertyId: c.property_id,
          tenant: (c.tenants as unknown as { full_name: string }).full_name,
        };
        break;
      }
    }
    expect(target).not.toBeNull();
    const url = `/ar/collections?period=${period}&property=${target!.propertyId}`;

    await login(page, "collector");
    await waitForServiceWorker(page);
    await page.goto(url);
    await expect(page.getByText(target!.tenant).locator("visible=true").first()).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(target!.tenant).locator("visible=true").first()).toBeVisible();
    await page.getByText(target!.tenant).locator("visible=true").first().click();
    await page.getByRole("button", { name: /حفظ الدفعة/ }).click();
    await expect(page.getByText(/أنت غير متصل/).first()).toBeVisible();
    const queued = await page.evaluate(async () => {
      return await new Promise<{ clientId: string; input: unknown }[]>((resolve) => {
        const req = indexedDB.open("ijari-offline");
        req.onsuccess = () => {
          const tx = req.result.transaction("outbox", "readonly");
          const all = tx.objectStore("outbox").getAll();
          all.onsuccess = () => resolve(all.result as { clientId: string; input: unknown }[]);
        };
      });
    });
    expect(queued).toHaveLength(1);
    const clientId = queued[0]!.clientId;

    // Reconnecting must never hard-reload the page (a collector may be mid-form).
    await page.evaluate(() => ((window as unknown as { __alive: boolean }).__alive = true));
    await context.setOffline(false);
    await expect(page.getByText(/أنت غير متصل|جارٍ مزامنة/)).toHaveCount(0, { timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive)).toBe(
      true,
    );
    const { data: rows } = await db.from("payments").select("id").eq("client_id", clientId);
    expect(rows).toHaveLength(1);

    // Replaying the same outbox item (e.g. a retried background sync) never duplicates.
    const replay = await page.request.post("/api/offline/sync", {
      data: { items: [queued[0]!.input] },
    });
    const body = (await replay.json()) as { results: { ok: boolean; duplicate?: boolean }[] };
    expect(body.results[0]).toMatchObject({ ok: true, duplicate: true });
    const { data: after } = await db.from("payments").select("id").eq("client_id", clientId);
    expect(after).toHaveLength(1);
  });

  test("push: the service worker shows the notification in the recipient's language", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Uses the Chrome DevTools Protocol");
    await login(page, "admin");
    await context.grantPermissions(["notifications"], { origin: new URL(page.url()).origin });
    await waitForServiceWorker(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    const cdp = await context.newCDPSession(page);
    const regId = new Promise<string>((resolve) => {
      cdp.on(
        "ServiceWorker.workerRegistrationUpdated",
        (e: {
          registrations: { registrationId: string; scopeURL: string; isDeleted: boolean }[];
        }) => {
          const r = e.registrations.find((x) => !x.isDeleted);
          if (r) resolve(r.registrationId);
        },
      );
    });
    await cdp.send("ServiceWorker.enable");
    const origin = new URL(page.url()).origin;
    await cdp.send("ServiceWorker.deliverPushMessage", {
      origin,
      registrationId: await regId,
      data: JSON.stringify({
        title: "تم تحصيل ٣٠٠٫٠٠٠ د.ك",
        body: "الجابرية ١٥٧، وحدة ٥",
        url: "/ar/payments",
        tag: "e2e-push",
        lang: "ar",
        dir: "rtl",
        type: "payment_recorded",
      }),
    });
    await expect
      .poll(
        async () =>
          page.evaluate(async () =>
            (await (await navigator.serviceWorker.ready).getNotifications({ tag: "e2e-push" })).map(
              (n) => ({
                title: n.title,
                lang: n.lang,
                dir: n.dir,
                url: (n.data as { url: string }).url,
              }),
            ),
          ),
        { timeout: 25_000 },
      )
      .toEqual([{ title: "تم تحصيل ٣٠٠٫٠٠٠ د.ك", lang: "ar", dir: "rtl", url: "/ar/payments" }]);
  });
});
