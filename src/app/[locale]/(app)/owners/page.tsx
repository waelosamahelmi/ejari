import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { maskCivilId } from "@/domain/validation";
import { OwnersView } from "./owners-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "owners" });
  return { title: t("title") };
}

export default async function OwnersPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_reports" });
  const db = await supabaseServer();
  const { data } = await db.from("owners").select("id, full_name, civil_id, phones, portal_user_id, property_owners(share_pct, properties(id, name))").order("full_name");
  return (
    <OwnersView
      canEdit={can(ctx.role, "manage_master_data")}
      rows={(data ?? []).map((o) => ({
        id: o.id,
        name: o.full_name,
        civilId: maskCivilId(o.civil_id),
        phone: o.phones?.[0] ?? null,
        portal: !!o.portal_user_id,
        properties: (o.property_owners ?? []).map((po) => ({ name: (po.properties as unknown as { name: string }).name, share: Number(po.share_pct) })),
      }))}
    />
  );
}
