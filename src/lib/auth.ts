import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Role } from "@/domain/types";
import { can, type Capability } from "@/lib/permissions";
import type { Json } from "@/lib/supabase/types";

export interface OrgSettings {
  proration: boolean;
  dueDay: number;
  allocationStrategy: "fifo";
  receiptDuplicatePolicy: "warn" | "block";
  digits: "latn" | "arab";
  letterhead: boolean;
  poweredBy: boolean;
  accent: string;
  voucherThresholdFils: number;
  lateReminderDays: number[];
  numbering: {
    contractResidential: string;
    contractInvestment: string;
    receipt: string;
    voucher: string;
  };
  reminderTemplateAr: string;
  reminderTemplateEn: string;
}

export const DEFAULT_SETTINGS: OrgSettings = {
  proration: false,
  dueDay: 1,
  allocationStrategy: "fifo",
  receiptDuplicatePolicy: "warn",
  digits: "latn",
  letterhead: true,
  poweredBy: true,
  accent: "ink",
  voucherThresholdFils: 500000,
  lateReminderDays: [3, 7, 15, 30],
  numbering: { contractResidential: "R", contractInvestment: "I", receipt: "RC", voucher: "EX" },
  reminderTemplateAr:
    "السلام عليكم {{tenant_name}}،\nنود تذكيركم بوجود مبلغ مستحق قدره {{amount}} د.ك عن {{months}} للوحدة {{unit}} في {{property}}.\nنرجو التكرم بالسداد في أقرب وقت. شكرًا لكم.\n{{org_name}}",
  reminderTemplateEn:
    "Hello {{tenant_name}},\nThis is a friendly reminder that {{amount}} KWD is due for {{months}} for unit {{unit}} at {{property}}.\nThank you.\n{{org_name}}",
};

export function parseSettings(json: Json | null | undefined): OrgSettings {
  const raw = (
    json && typeof json === "object" && !Array.isArray(json) ? json : {}
  ) as Partial<OrgSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    numbering: { ...DEFAULT_SETTINGS.numbering, ...(raw.numbering ?? {}) },
  };
}

export interface UserPrefs {
  locale: "ar" | "en";
  theme: "light" | "dark" | "system";
  accent: string;
  digits: "latn" | "arab";
  density: "comfortable" | "compact";
  quietStart: string;
  quietEnd: string;
  digestTime: string;
  dashboardLayout: Json | null;
  sessionsCount: number;
  installPromptDismissedAt: string | null;
  mutedPropertyIds: string[];
  tourDoneAt: string | null;
  checklistDismissedAt: string | null;
}

export interface SessionContext {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  orgId: string;
  orgName: string;
  orgNameEn: string | null;
  orgLogo: string | null;
  settings: OrgSettings;
  prefs: UserPrefs;
  /** owner-portal users: their owner record ids */
  ownerIds: string[];
}

/** Resolves the signed-in user, their active org membership and preferences (cached per request). */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: members } = await supabase
    .from("org_members")
    .select("org_id, role, display_name, orgs(name, name_en, logo_path, settings)")
    .eq("user_id", user.id)
    .eq("active", true);
  if (!members || members.length === 0) return null;
  const preferred = (await cookies()).get("ijari-org")?.value;
  const m = members.find((x) => x.org_id === preferred) ?? members[0]!;
  const org = m.orgs as unknown as {
    name: string;
    name_en: string | null;
    logo_path: string | null;
    settings: Json;
  } | null;
  const { data: s } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  let ownerIds: string[] = [];
  if (m.role === "owner") {
    const { data: owners } = await supabase
      .from("owners")
      .select("id")
      .eq("portal_user_id", user.id);
    ownerIds = (owners ?? []).map((o) => o.id);
  }
  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: m.display_name ?? (user.email ?? "").split("@")[0] ?? "",
    role: m.role,
    orgId: m.org_id,
    orgName: org?.name ?? "",
    orgNameEn: org?.name_en ?? null,
    orgLogo: org?.logo_path ?? null,
    settings: parseSettings(org?.settings),
    prefs: {
      locale: (s?.locale as "ar" | "en") ?? "ar",
      theme: (s?.theme as UserPrefs["theme"]) ?? "system",
      accent: s?.accent ?? "ink",
      digits: (s?.digits as "latn" | "arab") ?? "latn",
      density: (s?.density as UserPrefs["density"]) ?? "comfortable",
      quietStart: s?.quiet_start?.slice(0, 5) ?? "22:00",
      quietEnd: s?.quiet_end?.slice(0, 5) ?? "08:00",
      digestTime: s?.digest_time?.slice(0, 5) ?? "09:00",
      dashboardLayout: s?.dashboard_layout ?? null,
      sessionsCount: s?.sessions_count ?? 0,
      installPromptDismissedAt: s?.install_prompt_dismissed_at ?? null,
      mutedPropertyIds: s?.muted_property_ids ?? [],
      tourDoneAt: s?.tour_done_at ?? null,
      checklistDismissedAt: s?.checklist_dismissed_at ?? null,
    },
    ownerIds,
  };
});

/** For pages: redirect to login when signed out, to the portal for owners, or to 403 when lacking a capability. */
export async function requireContext(
  locale: string,
  opts: { capability?: Capability; allowOwner?: boolean; staffOnly?: boolean } = {},
): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (ctx.role === "owner" && !opts.allowOwner) redirect(`/${locale}/owner`);
  if (opts.capability && !can(ctx.role, opts.capability)) redirect(`/${locale}/forbidden`);
  return ctx;
}

export class ActionError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ActionError";
  }
}

/** For server actions: throws ActionError instead of redirecting. */
export async function requireActionContext(capability?: Capability): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new ActionError("unauthenticated");
  if (capability && !can(ctx.role, capability)) throw new ActionError("forbidden");
  return ctx;
}
