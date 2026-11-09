import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { UsersView } from "./users-view";

export default async function UsersPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "manage_users" });
  const db = await supabaseServer();
  const { data } = await db
    .from("org_members")
    .select("id, user_id, role, display_name, email, active, property_ids")
    .order("created_at");
  const { data: properties } = await db
    .from("properties")
    .select("id,name")
    .eq("org_id", ctx.orgId)
    .order("name");
  const t = await getTranslations("settings.items");
  return (
    <UsersView
      title={t("users")}
      me={ctx.userId}
      properties={properties ?? []}
      rows={(data ?? []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        name: m.display_name ?? "",
        email: m.email ?? "",
        active: m.active,
        propertyIds: m.property_ids,
      }))}
    />
  );
}
