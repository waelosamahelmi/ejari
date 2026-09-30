import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { loadOrgData } from "@/server/queries/dataset";
import { propertySummaries } from "@/server/queries/properties";
import { signPaths } from "@/server/storage";
import { supabaseServer } from "@/lib/supabase/server";
import { periodOf, todayKuwait } from "@/domain/dates";
import { can } from "@/lib/permissions";
import { PropertiesView } from "./properties-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "properties" });
  return { title: t("title") };
}

export default async function PropertiesPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const list = propertySummaries(data, periodOf(today), today);
  const signed = await signPaths("media", list.map((p) => p.cover));
  const db = await supabaseServer();
  const { data: settings } = await db.from("user_settings").select("pinned_property_ids").eq("user_id", ctx.userId).maybeSingle();
  const owners = [...data.owners.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  const blurs = new Map<string, string | undefined>([...data.properties.values()].map((p) => [p.id, p.photos[0]?.blur]));
  return (
    <PropertiesView
      properties={list.map((p) => ({ ...p, coverUrl: p.cover ? (signed.get(p.cover) ?? null) : null, blur: blurs.get(p.id) }))}
      owners={owners}
      pinned={settings?.pinned_property_ids ?? []}
      canEdit={can(ctx.role, "manage_master_data")}
    />
  );
}
