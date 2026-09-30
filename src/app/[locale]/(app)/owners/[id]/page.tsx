import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { OwnerDetailView } from "./owner-detail-view";

export default async function OwnerPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_reports" });
  const db = await supabaseServer();
  const { data: o } = await db.from("owners").select("*, property_owners(share_pct, properties(id, name, area))").eq("id", id).maybeSingle();
  if (!o) notFound();
  const full = can(ctx.role, "manage_master_data");
  return (
    <OwnerDetailView
      canEdit={full}
      owner={{
        id: o.id,
        fullName: o.full_name,
        civilId: full ? (o.civil_id ?? "") : "",
        phones: o.phones ?? [],
        email: o.email ?? "",
        iban: o.iban ?? "",
        bankName: o.bank_name ?? "",
        address: o.address ?? "",
        notes: o.notes ?? "",
        portalLinked: !!o.portal_user_id,
        properties: (o.property_owners ?? []).map((po) => {
          const p = po.properties as unknown as { id: string; name: string; area: string | null };
          return { id: p.id, name: p.name, area: p.area, share: Number(po.share_pct) };
        }),
      }}
    />
  );
}
