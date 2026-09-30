"use client";
import { useState, useTransition } from "react";
import {
  Bath,
  BedDouble,
  ChevronRight,
  Droplets,
  FilePlus2,
  Gauge,
  Layers,
  MessageCircle,
  Pencil,
  Phone,
  Ruler,
  Trash2,
  Wrench,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { PhotoHero } from "@/components/ui/photo-hero";
import { GlassButton, GlassPill, glassButtonClass } from "@/components/ui/glass";
import { Card, CardHeader } from "@/components/ui/card";
import { AmenityColumn, ThumbStrip } from "@/components/ui/thumb-strip";
import { ContractStatusPill, UnitStatusPill } from "@/components/ui/chip";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/dialog";
import { Documents } from "@/components/domain/documents";
import { UnitFormSheet } from "@/components/domain/units/unit-form";
import { useMoney } from "@/components/shell/prefs-context";
import { deleteUnit, setUnitMaintenance } from "@/server/actions/master";
import { formatDate, parsePeriod, monthNameAr, monthNameEn } from "@/domain/dates";
import { PERIOD_STATUS_STYLE } from "@/lib/status";
import { whatsappLink } from "@/domain/validation";
import { cn } from "@/lib/utils";
import type { ContractStatus, PeriodStatus, UnitStatus, UnitType } from "@/domain/types";

export interface UnitDetail {
  id: string;
  label: string;
  type: UnitType;
  floor: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  paciNo: string | null;
  askingRentFils: number;
  elecMeterNo: string | null;
  waterMeterNo: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  underMaintenance: boolean;
  propertyId: string;
  propertyName: string;
  area: string | null;
  hero: string | null;
  heroBlur?: string;
  photos: { src: string; blur?: string }[];
}

export function UnitDetailView({
  unit: u,
  status,
  current,
  history,
  cells,
  vacantSince,
  canEdit,
  canContract,
  paymentAction,
}: {
  unit: UnitDetail;
  status: UnitStatus;
  current: {
    id: string;
    contractNo: string;
    status: ContractStatus;
    startDate: string;
    endDate: string;
    monthlyRentFils: number;
    tenantId: string;
    tenantName: string;
    phones: string[];
    arrearsFils: number;
    creditFils: number;
  } | null;
  history: {
    id: string;
    contractNo: string;
    status: ContractStatus;
    tenantName: string;
    startDate: string;
    endDate: string;
    rentFils: number;
  }[];
  cells: { period: string; status: PeriodStatus; amountFils: number; paidFils: number }[];
  vacantSince: string | null;
  canEdit: boolean;
  canContract: boolean;
  canPay?: boolean;
  paymentAction?: React.ReactNode;
}) {
  const t = useTranslations("units");
  const tp = useTranslations("properties.stack");
  const tType = useTranslations("enums.unitType");
  const tPeriod = useTranslations("enums.periodStatus");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const figure = current ? money(current.monthlyRentFils) : money(u.askingRentFils);
  const caption = current ? t("rentPerMonth") : t("askingPerMonth");
  const action = current ? (
    (paymentAction ?? null)
  ) : canContract ? (
    <Button asChild size="lg">
      <Link href={`/contracts/new?unit=${u.id}`}>
        <FilePlus2 />
        {t("actions.newContract")}
      </Link>
    </Button>
  ) : null;
  const floorText =
    u.type === "roof"
      ? tp("roof")
      : u.floor === null
        ? "—"
        : u.floor === 0
          ? tp("ground")
          : u.floor < 0
            ? tp("basement")
            : tp("floor", { n: u.floor });

  const amenities = [
    { icon: <Layers />, label: t("fields.type"), value: tType(u.type) },
    { icon: <Gauge />, label: t("fields.floor"), value: floorText },
    ...(u.areaM2
      ? [{ icon: <Ruler />, label: t("fields.area"), value: `${u.areaM2} ${tc("labels.sqm")}` }]
      : []),
    ...(u.bedrooms
      ? [{ icon: <BedDouble />, label: t("fields.bedrooms"), value: String(u.bedrooms) }]
      : []),
    ...(u.bathrooms
      ? [{ icon: <Bath />, label: t("fields.bathrooms"), value: String(u.bathrooms) }]
      : []),
    ...(u.elecMeterNo
      ? [{ icon: <Gauge />, label: t("fields.elecMeter"), value: u.elecMeterNo }]
      : []),
    ...(u.waterMeterNo
      ? [{ icon: <Droplets />, label: t("fields.waterMeter"), value: u.waterMeterNo }]
      : []),
  ];

  return (
    <div className="-mx-4 lg:mx-0 lg:pt-6">
      <PhotoHero
        src={u.hero}
        name={u.propertyName}
        alt={`${u.propertyName} ${u.label}`}
        location={u.propertyName}
        title={t("title", { label: u.label })}
        topStart={
          <Link
            href={`/properties/${u.propertyId}?tab=units`}
            aria-label={tc("actions.back")}
            className={glassButtonClass}
          >
            <ChevronRight className="rotate-180 rtl:rotate-0" />
          </Link>
        }
        topEnd={
          canEdit ? (
            <GlassButton aria-label={t("edit")} onClick={() => setEditing(true)}>
              <Pencil />
            </GlassButton>
          ) : undefined
        }
        pills={
          <>
            <GlassPill>{tType(u.type)}</GlassPill>
            <GlassPill>{floorText}</GlassPill>
            {current && (
              <GlassPill>
                <bdi className="num">{money(current.monthlyRentFils)}</bdi>
                {tc("labels.perMonth")}
              </GlassPill>
            )}
            {u.underMaintenance && (
              <GlassPill tone="strong">
                <Wrench />
                {tp("maintenance")}
              </GlassPill>
            )}
          </>
        }
      />
      <div className="bg-bg relative z-10 -mt-6 space-y-4 rounded-t-[28px] px-4 pt-5 pb-32 lg:mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-5 lg:space-y-0 lg:rounded-none lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-8">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <UnitStatusPill status={status} />
              {status === "vacant" && vacantSince && (
                <span className="text-label-2 text-[13px]">
                  {t("vacantSince", { date: formatDate(vacantSince) })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
              <AmenityColumn items={amenities} />
              {u.photos.length > 0 && (
                <ThumbStrip alt={u.label} photos={u.photos} className="self-start" />
              )}
            </div>
          </Card>
          <Card className="p-5">
            <CardHeader className="p-0 pb-4" title={t("sections.last12")} />
            <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {cells.map((c) => {
                const m = parsePeriod(c.period).m;
                return (
                  <li
                    key={c.period}
                    className="flex flex-col items-center gap-1"
                    title={`${c.period} · ${tPeriod(c.status)} · ${money(c.paidFils)} / ${money(c.amountFils)}`}
                  >
                    <span
                      className={cn("h-9 w-full rounded-[8px]", PERIOD_STATUS_STYLE[c.status].cell)}
                      aria-label={`${c.period} ${tPeriod(c.status)}`}
                    />
                    <span className="text-label-2 text-[11px]">
                      {locale === "ar" ? monthNameAr(m).slice(0, 3) : monthNameEn(m).slice(0, 3)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
          <GroupedSection header={t("sections.history")}>
            {history.length === 0 ? (
              <ListRow title={t("noContract")} />
            ) : (
              history.map((h) => (
                <ListRow
                  key={h.id}
                  LinkComponent={Link}
                  href={`/contracts/${h.id}`}
                  title={<span>{h.tenantName}</span>}
                  subtitle={
                    <span className="num">
                      {h.contractNo} · {formatDate(h.startDate)} – {formatDate(h.endDate)}
                    </span>
                  }
                  trailing={<ContractStatusPill status={h.status} />}
                  chevron
                />
              ))
            )}
          </GroupedSection>
          <section>
            <h3 className="text-label-2 px-5 pb-2 text-[13px] font-medium">
              {t("sections.documents")}
            </h3>
            <Documents entityType="unit" entityId={u.id} canEdit={canEdit} canDelete={canEdit} />
          </section>
        </div>
        <div className="space-y-4">
          <Card className="hidden items-center justify-between gap-4 p-5 lg:flex">
            <div>
              <div className="num text-[26px] font-semibold">{figure}</div>
              <div className="text-label-2 text-[13px]">{caption}</div>
            </div>
            {action}
          </Card>
          <GroupedSection header={t("sections.tenant")}>
            {current ? (
              <>
                <ListRow
                  LinkComponent={Link}
                  href={`/tenants/${current.tenantId}`}
                  title={current.tenantName}
                  subtitle={<span className="num">{current.contractNo}</span>}
                  chevron
                />
                <ListRow
                  title={t("rentPerMonth")}
                  trailing={
                    <span className="num text-label">{money(current.monthlyRentFils)}</span>
                  }
                />
                <ListRow
                  title={t("balance")}
                  trailing={
                    <span
                      className={cn(
                        "num",
                        current.arrearsFils > 0 ? "text-red-text" : "text-green-text",
                      )}
                    >
                      {current.arrearsFils > 0
                        ? money(current.arrearsFils)
                        : current.creditFils > 0
                          ? `+${money(current.creditFils)}`
                          : money(0)}
                    </span>
                  }
                />
                {current.phones[0] && (
                  <div className="flex gap-2 p-3">
                    <Button asChild variant="tinted" size="sm" className="flex-1">
                      <a href={`tel:+965${current.phones[0]}`}>
                        <Phone />
                        {tc("actions.call")}
                      </a>
                    </Button>
                    <Button asChild variant="tinted" size="sm" className="flex-1">
                      <a
                        href={whatsappLink(current.phones[0], "")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle />
                        {tc("actions.whatsapp")}
                      </a>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <ListRow
                title={t("noContract")}
                subtitle={`${t("askingPerMonth")}: ${money(u.askingRentFils)}`}
              />
            )}
          </GroupedSection>
          {canEdit && (
            <GroupedSection>
              <ListRow
                leading={<Wrench className="text-orange-text size-5" />}
                title={
                  u.underMaintenance ? t("actions.clearMaintenance") : t("actions.markMaintenance")
                }
                onClick={() =>
                  start(async () => {
                    await setUnitMaintenance(u.id, !u.underMaintenance);
                    toast.success(u.underMaintenance ? t("maintenanceOff") : t("maintenanceOn"));
                    router.refresh();
                  })
                }
              />
              <ListRow
                leading={<Trash2 className="text-red-text size-5" />}
                title={t("actions.delete")}
                destructive
                onClick={() => setConfirmDelete(true)}
              />
            </GroupedSection>
          )}
        </div>
      </div>

      <StickyActionBar className="lg:hidden" figure={figure} caption={caption} action={action} />

      <UnitFormSheet
        open={editing}
        onOpenChange={setEditing}
        propertyId={u.propertyId}
        unit={{
          id: u.id,
          propertyId: u.propertyId,
          label: u.label,
          type: u.type,
          floor: u.floor,
          areaM2: u.areaM2,
          bedrooms: u.bedrooms,
          bathrooms: u.bathrooms,
          paciNo: u.paciNo ?? "",
          askingRentFils: u.askingRentFils,
          elecMeterNo: u.elecMeterNo ?? "",
          waterMeterNo: u.waterMeterNo ?? "",
          notes: u.notes ?? "",
          active: u.active,
          sortOrder: u.sortOrder,
        }}
      />
      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteConfirm", { label: u.label })}
        description={t("deleteText")}
        confirmLabel={tc("actions.delete")}
        cancelLabel={tc("actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() =>
          start(async () => {
            const r = await deleteUnit(u.id);
            setConfirmDelete(false);
            if (r.ok) {
              toast.success(r.data === "deleted" ? t("deleted") : t("deactivated"));
              router.push(`/properties/${u.propertyId}?tab=units`);
            }
          })
        }
      />
    </div>
  );
}
