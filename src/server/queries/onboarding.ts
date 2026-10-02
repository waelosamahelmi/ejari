import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/auth";
import { setupChecklist, type ChecklistItem, type SetupCounts } from "@/domain/account";

export interface SetupChecklistData {
  items: ChecklistItem[];
  counts: SetupCounts;
  dismissed: boolean;
}

/** Live activation checklist for the new-office dashboard. */
export const getSetupChecklist = cache(async (ctx: SessionContext): Promise<SetupChecklistData> => {
  const db = await supabaseServer();
  const [properties, units, tenants, contracts, payments, members] = await Promise.all([
    db.from("properties").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("active", true),
    db.from("units").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("active", true),
    db.from("tenants").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId),
    db.from("contracts").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("status", "active"),
    db.from("payments").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("voided", false),
    db.from("org_members").select("*", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("active", true),
  ]);
  const counts: SetupCounts = {
    orgNamed: !!ctx.orgName,
    hasLogo: !!ctx.orgLogo,
    properties: properties.count ?? 0,
    units: units.count ?? 0,
    tenants: tenants.count ?? 0,
    contracts: contracts.count ?? 0,
    payments: payments.count ?? 0,
    members: members.count ?? 0,
  };
  return {
    items: setupChecklist(counts),
    counts,
    dismissed: !!ctx.prefs.checklistDismissedAt,
  };
});
