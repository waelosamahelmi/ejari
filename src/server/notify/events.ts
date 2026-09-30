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
export const EVENT_RECIPIENTS: Record<
  NotificationType,
  {
    roles: ("admin" | "accountant" | "collector")[];
    owner: boolean;
    self?: boolean;
    push: boolean;
    inApp: boolean;
  }
> = {
  payment_recorded: { roles: ["admin", "accountant"], owner: true, push: true, inApp: true },
  offline_synced: { roles: [], owner: false, self: true, push: true, inApp: true },
  offline_review: { roles: [], owner: false, self: true, push: true, inApp: true },
  daily_digest: {
    roles: ["admin", "accountant", "collector"],
    owner: false,
    push: true,
    inApp: false,
  },
  tenant_late: {
    roles: ["admin", "accountant", "collector"],
    owner: false,
    push: true,
    inApp: true,
  },
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
  /** Deliver push even during the recipients' quiet hours (test notifications). */
  ignoreQuietHours?: boolean;
  [k: string]: unknown;
}

async function translators() {
  const [ar, en] = await Promise.all([loadMessages("ar"), loadMessages("en")]);
  return {
    ar: createTranslator({
      // Western digits inside Arabic plurals, matching amounts (§5.1 default).
      locale: "ar-u-nu-latn" as "ar",
      messages: ar,
      namespace: "notifications.templates",
    }),
    en: createTranslator({ locale: "en", messages: en, namespace: "notifications.templates" }),
  };
}

/** Resolves recipients, writes in-app notifications (bilingual) and delivers web push. */
export async function notifyOrg(
  orgId: string,
  actorId: string | null,
  type: NotificationType,
  payload: NotifyPayload,
) {
  const db = supabaseAdmin();
  const rule = EVENT_RECIPIENTS[type];
  let userIds = new Set<string>(payload.userIds ?? []);
  let propertyId = payload.propertyId ?? null;
  if (!propertyId && payload.contractId) {
    const { data } = await db
      .from("contracts")
      .select("property_id")
      .eq("id", payload.contractId)
      .single();
    propertyId = data?.property_id ?? null;
  }
  if (!payload.userIds) {
    if (rule.self && actorId) userIds.add(actorId);
    if (rule.roles.length) {
      const { data } = await db
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("active", true)
        .in("role", rule.roles);
      for (const m of data ?? []) userIds.add(m.user_id);
    }
    if (rule.owner && propertyId) {
      const { data } = await db
        .from("property_owners")
        .select("owners(portal_user_id)")
        .eq("property_id", propertyId);
      for (const r of data ?? []) {
        const uid = (r.owners as unknown as { portal_user_id: string | null } | null)
          ?.portal_user_id;
        if (uid) userIds.add(uid);
      }
    }
  }
  // Per-property mute (Settings → Notifications).
  const propertyForMute = propertyId;
  if (propertyForMute && userIds.size) {
    const { data: muted } = await db
      .from("user_settings")
      .select("user_id")
      .in("user_id", [...userIds])
      .contains("muted_property_ids", [propertyForMute]);
    for (const m of muted ?? []) userIds.delete(m.user_id);
  }
  // Don't notify the actor about their own action (except self events).
  if (!rule.self && actorId) userIds.delete(actorId);
  userIds = new Set([...userIds]);
  if (userIds.size === 0) return 0;
  const t = await translators();
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(payload))
    if (typeof v === "string" || typeof v === "number") vars[k] = v;
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
  // Dedupe: users who already have a row for this key get nothing (not even a push).
  if (payload.dedupeKey) {
    const keys = [...userIds].map((u) => `${payload.dedupeKey}:${u}`);
    const { data: existing } = await db
      .from("notifications")
      .select("user_id")
      .in("dedupe_key", keys);
    for (const e of existing ?? []) userIds.delete(e.user_id);
    if (userIds.size === 0) return 0;
  }
  const { data: prefs } = await db
    .from("notification_preferences")
    .select("user_id, push, in_app")
    .eq("type", type)
    .in("user_id", [...userIds]);
  const prefBy = new Map((prefs ?? []).map((p) => [p.user_id, p]));
  const now = new Date().toISOString();
  // Every recipient gets a row (keeps dedupe exact); rows for users who don't want this
  // in-app are stored already read + dismissed, so they never show in the center.
  const rows = [...userIds].map((u) => {
    const inApp = prefBy.get(u)?.in_app ?? rule.inApp;
    return {
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
      ...(inApp ? {} : { read_at: now, dismissed_at: now }),
    };
  });
  const { data: inserted, error } = await db
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("user_id");
  if (error) console.error("[notify]", error.message);
  const fresh = new Set((inserted ?? []).map((r) => r.user_id));
  const pushTo = [...userIds].filter((u) => fresh.has(u) && (prefBy.get(u)?.push ?? rule.push));
  if (pushTo.length) {
    await deliverPush(
      pushTo,
      {
        type,
        url: payload.url,
        tag: payload.dedupeKey ?? `${type}:${payload.entityId ?? Date.now()}`,
        title: { ar: text("ar", "title"), en: text("en", "title") },
        body: { ar: text("ar", "body"), en: text("en", "body") },
      },
      { ignoreQuietHours: payload.ignoreQuietHours },
    );
  }
  return userIds.size;
}

export async function notifyEvent(
  ctx: Pick<SessionContext, "orgId" | "userId">,
  type: NotificationType,
  payload: NotifyPayload,
) {
  return notifyOrg(ctx.orgId, ctx.userId, type, payload);
}
