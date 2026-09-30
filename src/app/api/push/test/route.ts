import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { notifyEvent } from "@/server/notify/events";

/** Settings → Notifications → "Send test notification" (ignores quiet hours). */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const n = await notifyEvent(ctx, "test", {
    url: "/settings/notifications",
    dedupeKey: `test:${Date.now()}`,
    ignoreQuietHours: true,
  });
  return NextResponse.json({ ok: true, recipients: n });
}
