import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { buildingStack } from "@/server/queries/properties";
import { signPaths } from "@/server/storage";
import { addPeriods, periodOf, periodRange, todayKuwait } from "@/domain/dates";
import { balanceSummary } from "@/domain/ledger";
import { paymentHeatmap, vacantUnits } from "@/domain/reports";
import { can } from "@/lib/permissions";
import { UnitDetailView } from "./unit-detail-view";
import { RecordPaymentButton } from "@/components/domain/payments/record-payment-button";

export async function generateMetadata({ params }: LocaleParams<{ id: string }>) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data } = await db.from("units").select("label, properties(name)").eq("id", id).maybeSingle();
  return { title: data ? `${data.label} · ${(data.properties as unknown as { name: string }).name}` : "" };
}

export default async function UnitPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const { data: unit } = await db.from("units").select("*, properties(id, name, name_en, area, cover_image_path, photos)").eq("id", id).maybeSingle();
  if (!unit) notFound();
  const property = unit.properties as unknown as { id: string; name: string; name_en: string | null; area: string | null; cover_image_path: string | null; photos: { path: string; blur?: string }[] };
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const period = periodOf(today);
  const tile = buildingStack(data, property.id, period, today).find((u) => u.id === id);
  const contracts = data.ds.contracts.filter((c) => c.unitIds.includes(id)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = tile?.contractId ? contracts.find((c) => c.id === tile.contractId) : undefined;
  const balance = current ? balanceSummary(data.idx.ledger(current.id), today) : null;
  const periods = periodRange(addPeriods(period, -11), period);
  const heat = paymentHeatmap(data.idx, periods, today).find((r) => r.unitId === id);
  const vacant = vacantUnits(data.idx, today).find((v) => v.unitId === id);
  const unitPhotos = (unit.photos as { path: string; blur?: string }[] | null) ?? [];
  const propPhotos = property.photos ?? [];
  const signed = await signPaths("media", [...unitPhotos.map((p) => p.path), property.cover_image_path]);
  const heroSrc = unitPhotos[0] ? signed.get(unitPhotos[0].path) : property.cover_image_path ? signed.get(property.cover_image_path) : null;
  const tenant = current ? data.tenants.get(current.tenantId) : undefined;
  return (
    <UnitDetailView
      unit={{
        id: unit.id,
        label: unit.label,
        type: unit.type,
        floor: unit.floor,
        areaM2: unit.area_m2 === null ? null : Number(unit.area_m2),
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        paciNo: unit.paci_no,
        askingRentFils: unit.asking_rent_fils,
        elecMeterNo: unit.elec_meter_no,
        waterMeterNo: unit.water_meter_no,
        notes: unit.notes,
        active: unit.active,
        sortOrder: unit.sort_order,
        underMaintenance: unit.under_maintenance,
        propertyId: property.id,
        propertyName: locale === "en" && property.name_en ? property.name_en : property.name,
        area: property.area,
        hero: heroSrc ?? null,
        heroBlur: unitPhotos[0]?.blur ?? propPhotos[0]?.blur,
        photos: unitPhotos.map((p) => ({ src: signed.get(p.path) ?? p.path, blur: p.blur })),
      }}
      status={tile?.status ?? "vacant"}
      current={
        current && tenant
          ? {
              id: current.id,
              contractNo: current.contractNo,
              status: current.status,
              startDate: current.startDate,
              endDate: current.endDate,
              monthlyRentFils: current.monthlyRentFils,
              tenantId: tenant.id,
              tenantName: tenant.fullName,
              phones: tenant.phones,
              arrearsFils: balance?.arrearsFils ?? 0,
              creditFils: balance?.creditFils ?? 0,
            }
          : null
      }
      history={contracts.map((c) => ({ id: c.id, contractNo: c.contractNo, status: c.status, tenantName: c.tenantName, startDate: c.startDate, endDate: c.moveOutDate ?? c.endDate, rentFils: c.monthlyRentFils }))}
      cells={heat?.cells.map((c) => ({ period: c.period, status: c.status, amountFils: c.amountFils, paidFils: c.paidFils })) ?? []}
      vacantSince={vacant?.vacantSince ?? null}
      canEdit={can(ctx.role, "manage_master_data")}
      canContract={can(ctx.role, "manage_contracts")}
      canPay={can(ctx.role, "record_payment")}
      paymentAction={current && can(ctx.role, "record_payment") ? <RecordPaymentButton contractId={current.id} variant="rose" /> : undefined}
    />
  );
}
