import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hourKuwait } from "@/domain/dates";

let configured: boolean | null = null;
function configure() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@ejarikw.com", pub!, priv!);
  return configured;
}

export interface PushMessage {
  type: string;
  url: string;
  tag: string;
  title: { ar: string; en: string };
  body: { ar: string; en: string };
}

function inQuietHours(now: number, start: string, end: string): boolean {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const s = toMin(start);
  const e = toMin(end);
  return s === e ? false : s < e ? now >= s && now < e : now >= s || now < e;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const q = [...items];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => {
    while (q.length) await fn(q.shift()!);
  }));
}

/**
 * Sends web push to users' subscriptions in each recipient's language, honoring
 * quiet hours (Kuwait time); concurrency 10 with retry/backoff; 404/410 deletes
 * the subscription. No-op when VAPID keys aren't configured.
 */
export async function deliverPush(userIds: string[], msg: PushMessage, opts: { ignoreQuietHours?: boolean } = {}) {
  if (!configure() || userIds.length === 0) return 0;
  const db = supabaseAdmin();
  const [{ data: subs }, { data: settings }] = await Promise.all([
    db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, locale, failed_count").in("user_id", userIds),
    db.from("user_settings").select("user_id, locale, quiet_start, quiet_end").in("user_id", userIds),
  ]);
  const byUser = new Map((settings ?? []).map((s) => [s.user_id, s]));
  const d = new Date();
  const nowMin = hourKuwait(d) * 60 + Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuwait", minute: "2-digit" }).format(d));
  let sent = 0;
  await pool(subs ?? [], 10, async (s) => {
    const us = byUser.get(s.user_id);
    if (!opts.ignoreQuietHours && us && inQuietHours(nowMin, us.quiet_start ?? "22:00", us.quiet_end ?? "08:00")) return;
    const lang = (us?.locale ?? s.locale ?? "ar") === "en" ? "en" : "ar";
    const payload = JSON.stringify({
      title: msg.title[lang],
      body: msg.body[lang],
      url: `/${lang}${msg.url.startsWith("/") ? msg.url : `/${msg.url}`}`,
      tag: msg.tag,
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      type: msg.type,
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "normal", topic: msg.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined });
        sent++;
        await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString(), failed_count: 0 }).eq("id", s.id);
        return;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.from("push_subscriptions").delete().eq("id", s.id);
          return;
        }
        if (attempt === 2) {
          await db.from("push_subscriptions").update({ failed_count: (s.failed_count ?? 0) + 1 }).eq("id", s.id);
          return;
        }
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
  });
  return sent;
}

export { inQuietHours };
