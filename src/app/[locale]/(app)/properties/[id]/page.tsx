import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { buildingStack, propertySummaries } from "@/server/queries/properties";
import { signPaths } from "@/server/storage";
import { addPeriods, periodOf, periodRange, todayKuwait } from "@/domain/dates";
import { lateUnits, monthlySummary } from "@/domain/reports";
import { can } from "@/lib/permissions";
import { PropertyDetailView } from "./property-detail-view";
import { StatementEmbed } from "@/components/domain/properties/statement-embed";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: LocaleParams<{ id: string }>) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data } = await db.from("properties").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "" };
}

export default async function PropertyPage({ params, searchParams }: LocaleParams<{ id: string }> & { searchParams: Promise<{ tab?: string }> }) {
  const { locale, id } = await pageLocale(params);
  const { tab } = await searchParams;
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const { data: property } = await db
    .from("properties")
    .select("*, property_owners(owner_id, share_pct, owners(id, full_name, phones)), property_commissions(kind, value)")
    .eq("id", id)
    .maybeSingle();
  if (!property) notFound();
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const period = periodOf(today);
  const summary = propertySummaries(data, period, today).find((p) => p.id === id)!;
  const stack = buildingStack(data, id, period, today);
  const trend = periodRange(addPeriods(period, -11), period).map((p) => {
    const row = monthlySummary(data.idx, p, { propertyIds: [id] }).rows[0];
    return { period: p, expected: row?.expectedFils ?? 0, collected: row?.collectedFils ?? 0 };
  });
  const late = lateUnits(data.idx, today, { propertyIds: [id] });
  const photos = (property.photos as { path: string; blur?: string }[] | null) ?? [];
  const signed = await signPaths("media", [property.cover_image_path, ...photos.map((p) => p.path)]);
  const owners = [...data.owners.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));
  const commission = property.property_commissions?.[0] ?? null;
  const tTabs = await getTranslations("properties.tabs");
  return (
    <PropertyDetailView
      tab={tab ?? "overview"}
      property={{
        id: property.id,
        name: property.name,
        nameEn: property.name_en,
        area: property.area,
        block: property.block,
        street: property.street,
        avenue: property.avenue,
        houseOrPlot: property.house_or_plot,
        paciNo: property.paci_no,
        propertyType: property.property_type,
        floors: property.floors,
        notes: property.notes,
        active: property.active,
        cover: property.cover_image_path ? (signed.get(property.cover_image_path) ?? null) : null,
        coverBlur: photos[0]?.blur,
        photos: photos.map((p) => ({ path: p.path, url: signed.get(p.path) ?? p.path, blur: p.blur })),
        owners: (property.property_owners ?? []).map((po) => {
          const o = po.owners as unknown as { id: string; full_name: string; phones: string[] };
          return { ownerId: o.id, name: o.full_name, phones: o.phones, sharePct: Number(po.share_pct) };
        }),
        commission: commission ? { kind: commission.kind, value: Number(commission.value) } : null,
      }}
      summary={summary}
      stack={stack}
      trend={trend}
      lateCount={late.length}
      allOwners={owners}
      canEdit={can(ctx.role, "manage_master_data")}
      period={period}
      extraTabs={[{ key: "statement", label: tTabs("statement"), after: "units", content: <StatementEmbed propertyId={id} initialPeriod={period} canExport={can(ctx.role, "view_late_units")} /> }]}
    />
  );
}
