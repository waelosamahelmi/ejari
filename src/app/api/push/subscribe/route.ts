import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const subSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({ p256dh: z.string().min(10).max(512), auth: z.string().min(8).max(256) }),
  }),
  locale: z.enum(["ar", "en"]).default("ar"),
});

/** Stores this device's push subscription for the signed-in user (RLS: own rows only). */
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation" }, { status: 400 });
  const { subscription: s, locale } = parsed.data;
  const db = await supabaseServer();
  // One row per endpoint: a device re-subscribing (or switching accounts) replaces its old row.
  await supabaseAdmin().from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  const { error } = await db.from("push_subscriptions").insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    endpoint: s.endpoint,
    p256dh: s.keys.p256dh,
    auth: s.keys.auth,
    locale,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "validation" }, { status: 400 });
  const db = await supabaseServer();
  await db
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", ctx.userId);
  return NextResponse.json({ ok: true });
}
