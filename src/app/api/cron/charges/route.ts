import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureChargesUntil, MATERIALIZE_AHEAD } from "@/server/billing/ensure-charges";
import { parseSettings } from "@/lib/auth";
import { addPeriods, periodOf, todayKuwait } from "@/domain/dates";

/** Nightly: materialize charges for every org through the current month + 3 (Vercel Cron, Bearer CRON_SECRET). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const { data: orgs } = await db.from("orgs").select("id, settings");
  const until = addPeriods(periodOf(todayKuwait()), MATERIALIZE_AHEAD);
  const out: Record<string, number> = {};
  for (const o of orgs ?? [])
    out[o.id] = await ensureChargesUntil(o.id, until, parseSettings(o.settings));
  return NextResponse.json({ until, created: out });
}
