import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sent: { endpoint: string; payload: Record<string, string> }[] = [];
const failFor = new Map<string, number>();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      const code = failFor.get(sub.endpoint);
      if (code) throw Object.assign(new Error("push failed"), { statusCode: code });
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) as Record<string, string> });
    }),
  },
}));

const deleted: string[] = [];
const subs = [
  {
    id: "s1",
    user_id: "u-ar",
    endpoint: "https://push.example/ar",
    p256dh: "k",
    auth: "a",
    locale: "ar",
    failed_count: 0,
  },
  {
    id: "s2",
    user_id: "u-en",
    endpoint: "https://push.example/en",
    p256dh: "k",
    auth: "a",
    locale: "en",
    failed_count: 0,
  },
  {
    id: "s3",
    user_id: "u-gone",
    endpoint: "https://push.example/gone",
    p256dh: "k",
    auth: "a",
    locale: "ar",
    failed_count: 0,
  },
];
const settings = [
  { user_id: "u-ar", locale: "ar", quiet_start: "22:00:00", quiet_end: "08:00:00" },
  { user_id: "u-en", locale: "en", quiet_start: "22:00:00", quiet_end: "08:00:00" },
];
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async (_c: string, ids: string[]) => ({
          data: (table === "push_subscriptions" ? subs : settings).filter((r) =>
            ids.includes(r.user_id),
          ),
        }),
      }),
      update: () => ({ eq: async () => ({}) }),
      delete: () => ({ eq: async (_c: string, id: string) => void deleted.push(id) }),
    }),
  }),
}));

const msg = {
  type: "payment_recorded",
  url: "/payments",
  tag: "t1",
  title: { ar: "تم التحصيل", en: "Payment recorded" },
  body: { ar: "٣٠٠ د.ك", en: "300 KWD" },
};

describe("deliverPush", () => {
  beforeEach(() => {
    sent.length = 0;
    deleted.length = 0;
    failFor.clear();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("sends each recipient their own language, direction and localized deep link", async () => {
    vi.setSystemTime(new Date("2026-09-30T09:00:00Z")); // 12:00 Kuwait
    const { deliverPush } = await import("@/server/notify/push");
    expect(await deliverPush(["u-ar", "u-en"], msg)).toBe(2);
    const ar = sent.find((s) => s.endpoint.endsWith("/ar"))!.payload;
    const en = sent.find((s) => s.endpoint.endsWith("/en"))!.payload;
    expect(ar).toMatchObject({
      title: "تم التحصيل",
      lang: "ar",
      dir: "rtl",
      url: "/ar/payments",
      tag: "t1",
    });
    expect(en).toMatchObject({
      title: "Payment recorded",
      lang: "en",
      dir: "ltr",
      url: "/en/payments",
    });
  });

  it("respects quiet hours (Kuwait time) unless told to ignore them", async () => {
    vi.setSystemTime(new Date("2026-09-30T20:30:00Z")); // 23:30 Kuwait
    const { deliverPush } = await import("@/server/notify/push");
    expect(await deliverPush(["u-ar"], msg)).toBe(0);
    expect(await deliverPush(["u-ar"], msg, { ignoreQuietHours: true })).toBe(1);
  });

  it("deletes subscriptions the push service reports as gone (410)", async () => {
    vi.setSystemTime(new Date("2026-09-30T09:00:00Z"));
    failFor.set("https://push.example/gone", 410);
    const { deliverPush } = await import("@/server/notify/push");
    expect(await deliverPush(["u-gone"], msg)).toBe(0);
    expect(deleted).toEqual(["s3"]);
  });

  it("inQuietHours handles windows that wrap midnight", async () => {
    const { inQuietHours } = await import("@/server/notify/push");
    expect(inQuietHours(23 * 60, "22:00", "08:00")).toBe(true);
    expect(inQuietHours(7 * 60 + 59, "22:00", "08:00")).toBe(true);
    expect(inQuietHours(8 * 60, "22:00", "08:00")).toBe(false);
    expect(inQuietHours(13 * 60, "12:00", "14:00")).toBe(true);
    expect(inQuietHours(10 * 60, "09:00", "09:00")).toBe(false);
  });
});
