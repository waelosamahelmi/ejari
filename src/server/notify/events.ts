import "server-only";
import { createTranslator } from "next-intl";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SessionContext } from "@/lib/auth";
import { fromFils } from "@/domain/money";
import { loadMessages } from "@/messages";
import { deliverPush } from "./push";

export type NotificationType =
  | "payment_recorded"
  | "offline_synced"
  | "offline_review"
  | "daily_digest"
  | "tenant_late"
  | "grace_ending"
  | "contract_expiring"
  | "notice_recorded"
  | "unit_vacant"
  | "hearing_tomorrow"
  | "voucher_threshold"
  | "month_end"
  | "deposit_recorded"
  | "statement_ready"
  | "test";

/** Recipients by role (§19.5); "owner" = owners of the related property. */
export const EVENT_RECIPIENTS: Record<NotificationType, { roles: ("admin" | "accountant" | "collector")[]; owner: boolean; self?: boolean; push: boolean; inApp: boolean }> = {
  payment_recorded: { roles: ["admin", "accountant"], owner: true, push: true, inApp: true },
  offline_synced: { roles: [], owner: false, self: true, push: true, inApp: true },
  offline_review: { roles: [], owner: false, self: true, push: true, inApp: true },
  daily_digest: { roles: ["admin", "accountant", "collector"], owner: false, push: true, inApp: false },
  tenant_late: { roles: ["admin", "accountant", "collector"], owner: false, push: true, inApp: true },
  grace_ending: { roles: ["admin", "accountant"], owner: false, push: false, inApp: true },
  contract_expiring: { roles: ["admin", "accountant"], owner: false, push: true, inApp: true },
  notice_recorded: { roles: ["admin", "accountant"], owner: true, push: true, inApp: true },
  unit_vacant: { roles: ["admin", "accountant"], owner: true, push: false, inApp: true },
  hearing_tomorrow: { roles: ["admin", "accountant"], owner: false, push: true, inApp: false },
  voucher_threshold: { roles: ["admin"], owner: true, push: true, inApp: true },
  month_end: { roles: ["admin", "accountant"], owner: false, push: true, inApp: false },
  deposit_recorded: { roles: [], owner: true, push: true, inApp: true },
  statement_ready: { roles: [], owner: true, push: true, inApp: false },
  test: { roles: [], owner: false, self: true, push: true, inApp: true },
};

export interface NotifyPayload {
  url: string;
  entityId?: string | null;
  entityType?: string | null;
  propertyId?: string | null;
  contractId?: string | null;
  amountFils?: number;
  dedupeKey?: string;
  /** Explicit recipients (overrides role resolution). */
  userIds?: string[];
  [k: string]: unknown;
}

async function translators() {
  const [ar, en] = await Promise.all([loadMessages("ar"), loadMessages("en")]);
  return {
    ar: createTranslator({ locale: "ar", messages: ar, namespace: "notifications.templates" }),
    en: createTranslator({ locale: "en", messages: en, namespace: "notifications.templates" }),
  };
}

/** Resolves recipients, writes in-app notifications (bilingual) and delivers web push. */
export async function notifyOrg(orgId: string, actorId: string | null, type: NotificationType, payload: NotifyPayload) {
  const db = supabaseAdmin();
  const rule = EVENT_RECIPIENTS[type];
  let userIds = new Set<string>(payload.userIds ?? []);
  if (!payload.userIds) {
    if (rule.self && actorId) userIds.add(actorId);
    if (rule.roles.length) {
      const { data } = await db.from("org_members").select("user_id").eq("org_id", orgId).eq("active", true).in("role", rule.roles);
      for (const m of data ?? []) userIds.add(m.user_id);
    }
    let propertyId = payload.propertyId ?? null;
    if (!propertyId && payload.contractId) {
      const { data } = await db.from("contracts").select("property_id").eq("id", payload.contractId).single();
      propertyId = data?.property_id ?? null;
    }
    if (rule.owner && propertyId) {
      const { data } = await db.from("property_owners").select("owners(portal_user_id)").eq("property_id", propertyId);
      for (const r of data ?? []) {
        const uid = (r.owners as unknown as { portal_user_id: string | null } | null)?.portal_user_id;
        if (uid) userIds.add(uid);
      }
    }
  }
  // Don't notify the actor about their own action (except self events).
  if (!rule.self && actorId) userIds.delete(actorId);
  userIds = new Set([...userIds]);
  if (userIds.size === 0) return 0;
  const t = await translators();
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(payload)) if (typeof v === "string" || typeof v === "number") vars[k] = v;
  if (payload.amountFils !== undefined) vars.amount = fromFils(payload.amountFils);
  vars.property ??= String(payload.propertyName ?? "");
  vars.unit ??= String(payload.unitLabels ?? "");
  const text = (loc: "ar" | "en", part: "title" | "body") => {
    try {
      return t[loc](`${type}.${part}` as "test.title", vars as never);
    } catch {
      return t[loc](`test.${part}` as "test.title");
    }
  };
  const { data: prefs } = await db.from("notification_preferences").select("user_id, push, in_app").eq("type", type).in("user_id", [...userIds]);
  const prefBy = new Map((prefs ?? []).map((p) => [p.user_id, p]));
  const rows = [...userIds]
    .filter((u) => prefBy.get(u)?.in_app ?? rule.inApp ?? true)
    .map((u) => ({
      org_id: orgId,
      user_id: u,
      type,
      title_ar: text("ar", "title"),
      title_en: text("en", "title"),
      body_ar: text("ar", "body"),
      body_en: text("en", "body"),
      url: payload.url,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      dedupe_key: payload.dedupeKey ? `${payload.dedupeKey}:${u}` : null,
      ...(rule.inApp ? {} : { read_at: new Date().toISOString() }),
    }));
  if (rows.length) {
    const { error } = await db.from("notifications").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (error) console.error("[notify]", error.message);
  }
  const pushTo = [...userIds].filter((u) => prefBy.get(u)?.push ?? rule.push);
  if (pushTo.length) {
    await deliverPush(pushTo, {
      type,
      url: payload.url,
      tag: payload.dedupeKey ?? `${type}:${payload.entityId ?? Date.now()}`,
      title: { ar: text("ar", "title"), en: text("en", "title") },
      body: { ar: text("ar", "body"), en: text("en", "body") },
    });
  }
  return userIds.size;
}

export async function notifyEvent(ctx: Pick<SessionContext, "orgId" | "userId">, type: NotificationType, payload: NotifyPayload) {
  return notifyOrg(ctx.orgId, ctx.userId, type, payload);
}
