import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseSettings } from "@/lib/auth";
import { fetchOrgData } from "@/server/queries/dataset";
import { notifyOrg, EVENT_RECIPIENTS } from "@/server/notify/events";
import { digestSummary, scheduledEvents } from "@/domain/notifications";
import { hourKuwait, todayKuwait } from "@/domain/dates";

export const maxDuration = 300;

/**
 * Hourly (Vercel Cron, Bearer CRON_SECRET). Decisions use Kuwait local time:
 * - daily digest to each user at their digest hour (default 09:00),
 * - time-based alerts (late 3/7/15/30 days, grace ending, contracts expiring in
 *   90/60/30 days, hearing tomorrow, month-end close) during the day, 09:00–21:59.
 * Every event has a dedupe key, so repeated runs notify exactly once.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hour = Number(req.nextUrl.searchParams.get("hour") ?? hourKuwait());
  const today = req.nextUrl.searchParams.get("today") ?? todayKuwait();
  const db = supabaseAdmin();
  const { data: orgs } = await db.from("orgs").select("id, settings");
  const report: Record<string, { events: number; digests: number }> = {};

  for (const org of orgs ?? []) {
    const settings = parseSettings(org.settings);
    const data = await fetchOrgData(db, org.id, { finance: true, legal: true });
    let events = 0;
    let digests = 0;

    if (hour >= 9 && hour < 22) {
      const { data: closings } = await db
        .from("monthly_closings")
        .select("period")
        .eq("org_id", org.id);
      const list = scheduledEvents(data.idx, today, {
        lateDays: settings.lateReminderDays,
        closedPeriods: (closings ?? []).map((c) => c.period),
        tenantName: (id) => data.tenants.get(id)?.fullName ?? "",
      });
      for (const e of list) {
        events += await notifyOrg(org.id, null, e.type, {
          url: e.url,
          dedupeKey: e.dedupeKey,
          contractId: e.contractId,
          propertyId: e.propertyId,
          entityId: e.entityId,
          entityType: e.contractId ? "contract" : null,
          amountFils: e.amountFils,
          ...e.vars,
        });
      }
    }

    // Digest: recipients whose digest hour is now.
    const { data: members } = await db
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", org.id)
      .eq("active", true)
      .in("role", EVENT_RECIPIENTS.daily_digest.roles);
    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.length) {
      const { data: us } = await db
        .from("user_settings")
        .select("user_id, digest_time")
        .in("user_id", ids);
      const hourOf = new Map(
        (us ?? []).map((u) => [u.user_id, Number(String(u.digest_time ?? "09:00").slice(0, 2))]),
      );
      const due = ids.filter((id) => (hourOf.get(id) ?? 9) === hour);
      if (due.length) {
        const d = digestSummary(data.idx, today);
        digests = await notifyOrg(org.id, null, "daily_digest", {
          url: "/collections",
          userIds: due,
          dedupeKey: `digest:${today}`,
          due: d.due,
          late: d.late,
          amountFils: d.amountFils,
        });
      }
    }
    report[org.id] = { events, digests };
  }
  return NextResponse.json({ today, hour, report });
}
