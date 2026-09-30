"use client";
import { useRef, useState, useTransition } from "react";
import {
  ArrowUpToLine,
  ChevronRight,
  Layers3,
  MapPinned,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { PhotoHero } from "@/components/ui/photo-hero";
import { GlassButton, GlassPill, glassButtonClass } from "@/components/ui/glass";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ProgressRing, Meter, Sparkline } from "@/components/ui/charts";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { HeaderUtilities } from "@/components/shell/app-shell";
import { BuildingStack, type StackTile } from "@/components/domain/properties/building-stack";
import { PropertyFormSheet } from "@/components/domain/properties/property-form";
import { UnitFormSheet } from "@/components/domain/units/unit-form";
import { BulkUnitsSheet } from "@/components/domain/units/bulk-units";
import { Documents } from "@/components/domain/documents";
import { useMoney, useNum } from "@/components/shell/prefs-context";
import { reorderPhotos, uploadPhoto } from "@/server/actions/files";
import { setPropertyActive } from "@/server/actions/master";
import { formatPeriod } from "@/domain/dates";
import type { PropertySummary } from "@/server/queries/properties";
import { cn } from "@/lib/utils";

export interface PropertyDetail {
  id: string;
  name: string;
  nameEn: string | null;
  area: string | null;
  block: string | null;
  street: string | null;
  avenue: string | null;
  houseOrPlot: string | null;
  paciNo: string | null;
  propertyType: "residential" | "investment" | "mixed" | "industrial";
  floors: number | null;
  notes: string | null;
  active: boolean;
  cover: string | null;
  coverBlur?: string;
  photos: { path: string; url: string; blur?: string }[];
  owners: { ownerId: string; name: string; phones: string[]; sharePct: number }[];
  commission: { kind: "percent" | "fixed"; value: number } | null;
}

export const PROPERTY_TABS = ["overview", "units", "documents", "settings"] as const;

export function PropertyDetailView({
  tab: initialTab,
  property: p,
  summary,
  stack,
  trend,
  lateCount,
  allOwners,
  canEdit,
  extraTabs,
  period,
}: {
  tab: string;
  property: PropertyDetail;
  summary: PropertySummary;
  stack: StackTile[];
  trend: { period: string; expected: number; collected: number }[];
  lateCount: number;
  allOwners: { id: string; fullName: string }[];
  canEdit: boolean;
  extraTabs?: { key: string; label: string; content: React.ReactNode; after: string }[];
  period?: string;
}) {
  const t = useTranslations("properties");
  const tc = useTranslations("common");
  const tEnum = useTranslations("enums");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const num = useNum();
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [unitSheet, setUnitSheet] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const tabs: { key: string; label: string }[] = [
    ...PROPERTY_TABS.map((k) => ({ key: k as string, label: t(`tabs.${k}`) })),
  ];
  for (const x of extraTabs ?? [])
    tabs.splice(tabs.findIndex((y) => y.key === x.after) + 1, 0, { key: x.key, label: x.label });
  const name = locale === "en" && p.nameEn ? p.nameEn : p.name;
  const collectRate = summary.expectedFils > 0 ? summary.collectedFils / summary.expectedFils : 0;
  const pct = (v: number) => num(Math.round(v * 100));
  const address = [
    p.area,
    p.block && `${t("fields.block")} ${p.block}`,
    p.street && `${t("fields.street")} ${p.street}`,
    p.avenue && `${t("fields.avenue")} ${p.avenue}`,
    p.houseOrPlot && `${t("fields.houseOrPlot")} ${p.houseOrPlot}`,
  ]
    .filter(Boolean)
    .join("، ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.area ?? ""} ${p.block ? `block ${p.block}` : ""} ${p.street ?? ""} Kuwait`)}`;

  const selectTab = (k: string) => {
    setTab(k);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", k);
    window.history.replaceState(null, "", url.toString());
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadPhoto("property", p.id, fd);
      if (!r.ok) toast.error(tc("actions.retry"));
    }
    setUploading(false);
    router.refresh();
  };

  return (
    <div className="-mx-4 lg:mx-0 lg:pt-6">
      <div className="relative">
        <PhotoHero
          src={p.cover}
          name={p.name}
          alt={name}
          location={p.area ?? undefined}
          title={name}
          topStart={
            <Link href="/properties" aria-label={tc("actions.back")} className={glassButtonClass}>
              <ChevronRight className="rotate-180 rtl:rotate-0" />
            </Link>
          }
          topEnd={
            <>
              {canEdit && (
                <GlassButton aria-label={t("edit")} onClick={() => setEditing(true)}>
                  <Pencil />
                </GlassButton>
              )}
              <div className="hidden lg:block [&_button]:!shadow-none">
                <HeaderUtilities />
              </div>
            </>
          }
          pills={
            <>
              <GlassPill>{t("pills.units", { count: summary.unitsCount })}</GlassPill>
              <GlassPill>{t("pills.occupancy", { pct: pct(summary.occupancyRate) })}</GlassPill>
              {summary.expectedFils > 0 && (
                <GlassPill>{t("pills.collected", { pct: pct(collectRate) })}</GlassPill>
              )}
              {summary.arrearsFils > 0 && (
                <GlassPill tone="danger">
                  {t("pills.arrears", { amount: money(summary.arrearsFils) })}
                </GlassPill>
              )}
              {!p.active && <GlassPill tone="strong">{t("inactive")}</GlassPill>}
            </>
          }
        />
      </div>

      <div className="bg-bg relative z-10 -mt-6 rounded-t-[28px] px-4 pt-5 lg:mt-5 lg:rounded-none lg:bg-transparent lg:px-0 lg:pt-0">
        <ChipScroller ariaLabel={t("tabs.overview")}>
          {tabs.map((x) => (
            <Chip
              key={x.key}
              active={tab === x.key}
              onClick={() => selectTab(x.key)}
              className="h-11 px-5 text-[15px]"
            >
              {x.label}
            </Chip>
          ))}
        </ChipScroller>

        <div className="mt-5 pb-28 lg:pb-6">
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-1">
                <CardHeader
                  className="p-0"
                  title={t("overview.thisMonth")}
                  subtitle={formatPeriod(trend.at(-1)!.period, locale)}
                />
                <div className="mt-5 flex items-center gap-5">
                  <ProgressRing
                    value={collectRate}
                    size={120}
                    stroke={13}
                    label={t("pills.collected", { pct: pct(collectRate) })}
                    celebrate={collectRate >= 1 && summary.expectedFils > 0}
                  >
                    <span className="num text-[24px] font-semibold">{pct(collectRate)}٪</span>
                  </ProgressRing>
                  <dl className="space-y-2 text-[14px]">
                    <div>
                      <dt className="text-label-2">{t("overview.collected")}</dt>
                      <dd className="num text-[20px] font-semibold">
                        {money(summary.collectedFils)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label-2">{t("overview.expected")}</dt>
                      <dd className="num text-[15px]">{money(summary.expectedFils)}</dd>
                    </div>
                  </dl>
                </div>
              </Card>
              <Card className="space-y-4 p-5">
                <CardHeader className="p-0" title={t("overview.occupancy")} />
                <div className="num text-[34px] font-semibold">{pct(summary.occupancyRate)}٪</div>
                <Meter
                  segments={[{ value: summary.occupancyRate, color: "var(--green)" }]}
                  label={t("overview.occupancy")}
                />
                <div className="text-label-2 flex justify-between text-[13px]">
                  <span>{t("pills.units", { count: summary.unitsCount })}</span>
                  <span>
                    {stack.filter((s) => s.status === "vacant").length} {t("overview.vacant")}
                  </span>
                </div>
              </Card>
              <Card className="space-y-3 p-5">
                <CardHeader
                  className="p-0"
                  title={t("overview.arrears")}
                  subtitle={lateCount ? `${lateCount} ${t("overview.late")}` : undefined}
                />
                <div
                  className={cn(
                    "num text-[34px] font-semibold",
                    summary.arrearsFils > 0 && "text-red-text",
                  )}
                >
                  {money(summary.arrearsFils)}
                </div>
                <div className="text-label-2 text-[13px]">{t("overview.lastMonths")}</div>
                <Sparkline data={trend.map((x) => x.collected)} width={260} height={44} />
              </Card>
              <GroupedSection header={t("overview.address")} className="lg:col-span-2">
                <ListRow
                  leading={
                    <IconTile tone="gulf">
                      <MapPinned />
                    </IconTile>
                  }
                  title={address || "—"}
                  subtitle={p.paciNo ? `${t("fields.paciNo")}: ${p.paciNo}` : undefined}
                />
                <ListRow
                  title={t("overview.openMaps")}
                  href={mapsUrl}
                  chevron
                  LinkComponent={(props: React.ComponentProps<"a">) => (
                    <a {...props} target="_blank" rel="noreferrer" />
                  )}
                />
              </GroupedSection>
              <GroupedSection header={t("overview.owners")}>
                {p.owners.map((o) => (
                  <ListRow
                    key={o.ownerId}
                    LinkComponent={Link}
                    href={`/owners/${o.ownerId}`}
                    title={o.name}
                    trailing={<span className="num">{num(o.sharePct)}٪</span>}
                    chevron
                  />
                ))}
              </GroupedSection>
            </div>
          )}

          {tab === "units" && (
            <Card className="p-4 sm:p-5">
              <CardHeader
                className="p-0 pb-4"
                title={t("stack.title")}
                action={
                  canEdit ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setBulk(true)}>
                        <Layers3 />
                        {t("stack.bulk")}
                      </Button>
                      <Button size="sm" onClick={() => setUnitSheet(true)}>
                        <Plus />
                        {t("stack.addUnit")}
                      </Button>
                    </div>
                  ) : undefined
                }
              />
              <BuildingStack units={stack} />
            </Card>
          )}

          {extraTabs?.map((x) => (tab === x.key ? <div key={x.key}>{x.content}</div> : null))}

          {tab === "documents" && (
            <Documents
              entityType="property"
              entityId={p.id}
              canEdit={canEdit}
              canDelete={canEdit}
            />
          )}

          {tab === "settings" && (
            <div className="space-y-6">
              <Card className="p-5">
                <CardHeader
                  className="p-0 pb-4"
                  title={t("fields.photos")}
                  action={
                    canEdit ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={uploading}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload />
                        {t("fields.addPhoto")}
                      </Button>
                    ) : undefined
                  }
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => void onUpload(e.target.files)}
                />
                {p.photos.length === 0 ? (
                  <p className="text-label-2 text-[14px]">{t("fields.addPhoto")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-3">
                    {p.photos.map((ph, i) => (
                      <li
                        key={ph.path}
                        className="relative aspect-[4/5] w-28 overflow-hidden rounded-[16px]"
                      >
                        <Image
                          src={ph.url}
                          alt=""
                          fill
                          sizes="112px"
                          className="object-cover"
                          placeholder={ph.blur ? "blur" : "empty"}
                          blurDataURL={ph.blur}
                        />
                        {i === 0 && (
                          <GlassPill className="absolute start-1.5 top-1.5 h-6 text-[11px]">
                            {t("fields.cover")}
                          </GlassPill>
                        )}
                        {canEdit && (
                          <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                            {i > 0 && (
                              <GlassButton
                                size="md"
                                className="size-8"
                                aria-label={t("fields.cover")}
                                onClick={() =>
                                  start(async () => {
                                    await reorderPhotos("property", p.id, [
                                      ph.path,
                                      ...p.photos
                                        .filter((x) => x.path !== ph.path)
                                        .map((x) => x.path),
                                    ]);
                                    router.refresh();
                                  })
                                }
                              >
                                <ArrowUpToLine className="!size-4" />
                              </GlassButton>
                            )}
                            <GlassButton
                              className="ms-auto size-8"
                              aria-label={tc("actions.remove")}
                              onClick={() =>
                                start(async () => {
                                  await reorderPhotos(
                                    "property",
                                    p.id,
                                    p.photos.filter((x) => x.path !== ph.path).map((x) => x.path),
                                  );
                                  router.refresh();
                                })
                              }
                            >
                              <Trash2 className="!size-4" />
                            </GlassButton>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <GroupedSection header={t("fields.commission")}>
                <ListRow
                  title={
                    p.commission
                      ? tEnum(`commissionKind.${p.commission.kind}`)
                      : t("fields.commissionNone")
                  }
                  trailing={
                    p.commission ? (
                      <span className="num">
                        {p.commission.kind === "percent"
                          ? `${num(p.commission.value)}٪`
                          : money(p.commission.value)}
                      </span>
                    ) : undefined
                  }
                  onClick={canEdit ? () => setEditing(true) : undefined}
                  chevron={canEdit}
                />
              </GroupedSection>
              {canEdit && (
                <GroupedSection>
                  <ListRow
                    title={p.active ? t("deactivate") : t("activate")}
                    destructive={p.active}
                    onClick={() =>
                      start(async () => {
                        await setPropertyActive(p.id, !p.active);
                        router.refresh();
                      })
                    }
                  />
                </GroupedSection>
              )}
            </div>
          )}
        </div>
      </div>

      {period && (
        <StickyActionBar
          className="lg:hidden"
          figure={t("collectedOf", {
            collected: money(summary.collectedFils, { showCurrency: false }),
            expected: money(summary.expectedFils),
          })}
          caption={t("overview.thisMonth")}
          action={
            <Button asChild size="md">
              <a
                href={`/print/statement/${p.id}/${period}?lang=${locale}`}
                target="_blank"
                rel="noreferrer"
              >
                <Printer />
                {t("printStatement")}
              </a>
            </Button>
          }
        />
      )}
      <PropertyFormSheet
        open={editing}
        onOpenChange={setEditing}
        owners={allOwners}
        property={{
          id: p.id,
          name: p.name,
          nameEn: p.nameEn ?? "",
          area: p.area ?? "",
          block: p.block ?? "",
          street: p.street ?? "",
          avenue: p.avenue ?? "",
          houseOrPlot: p.houseOrPlot ?? "",
          paciNo: p.paciNo ?? "",
          propertyType: p.propertyType,
          floors: p.floors,
          notes: p.notes ?? "",
          owners: p.owners.map((o) => ({ ownerId: o.ownerId, sharePct: o.sharePct })),
          commission: p.commission,
        }}
      />
      <UnitFormSheet open={unitSheet} onOpenChange={setUnitSheet} propertyId={p.id} />
      <BulkUnitsSheet open={bulk} onOpenChange={setBulk} propertyId={p.id} />
    </div>
  );
}
