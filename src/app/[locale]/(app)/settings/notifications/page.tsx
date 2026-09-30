import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { EVENT_RECIPIENTS, type NotificationType } from "@/server/notify/events";
import { NotificationSettings } from "./notification-settings";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "settings.items" });
  return { title: t("notifications") };
}

export default async function NotificationSettingsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const [{ data: settings }, { data: prefs }, { data: props }] = await Promise.all([
    db
      .from("user_settings")
      .select("quiet_start, quiet_end, digest_time, muted_property_ids")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    db.from("notification_preferences").select("type, push, in_app").eq("user_id", ctx.userId),
    db.from("properties").select("id, name").eq("active", true).order("name"),
  ]);
  // Only events this role actually receives (§19.5).
  const types = (Object.keys(EVENT_RECIPIENTS) as NotificationType[]).filter((k) => {
    if (k === "test") return false;
    const r = EVENT_RECIPIENTS[k];
    return (
      (r.self && ctx.role !== "owner" && ctx.role !== "viewer") ||
      (ctx.role !== "owner" && ctx.role !== "viewer" && r.roles.includes(ctx.role)) ||
      (ctx.role === "owner" && r.owner)
    );
  });
  const byType = new Map((prefs ?? []).map((p) => [p.type, p]));
  return (
    <NotificationSettings
      events={types.map((k) => ({
        type: k,
        push: byType.get(k)?.push ?? EVENT_RECIPIENTS[k].push,
        inApp: byType.get(k)?.in_app ?? EVENT_RECIPIENTS[k].inApp,
      }))}
      quietStart={(settings?.quiet_start ?? "22:00").slice(0, 5)}
      quietEnd={(settings?.quiet_end ?? "08:00").slice(0, 5)}
      digestTime={(settings?.digest_time ?? "09:00").slice(0, 5)}
      muted={settings?.muted_property_ids ?? []}
      properties={(props ?? []).map((p) => ({ id: p.id, name: p.name }))}
      hasDigest={types.includes("daily_digest")}
    />
  );
}
