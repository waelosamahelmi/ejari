"use client";
import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { Building2, Factory, Home, Layers, Plus, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { SearchField } from "@/components/ui/search-field";
import { ChipScroller, IconChip } from "@/components/ui/chip";
import { PropertyPhotoCard } from "@/components/ui/property-photo-card";
import { GlassPill } from "@/components/ui/glass";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoPropertiesIllustration, NoResultsIllustration } from "@/components/illustrations";
import { Select } from "@/components/ui/input";
import { togglePinnedProperty } from "@/server/actions/master";
import { useMoney, useNum } from "@/components/shell/prefs-context";
import type { PropertySummary } from "@/server/queries/properties";

// Sheets are code-split: they load after hydration instead of with the page.
const PropertyFormSheet = dynamic(
  () => import("@/components/domain/properties/property-form").then((m) => m.PropertyFormSheet),
  { ssr: false },
);

type Row = PropertySummary & { coverUrl: string | null; blur?: string };

const TYPE_ICON = {
  residential: Home,
  investment: Store,
  mixed: Layers,
  industrial: Factory,
} as const;

export function PropertiesView({
  properties,
  owners,
  pinned: initialPinned,
  canEdit,
}: {
  properties: Row[];
  owners: { id: string; fullName: string }[];
  pinned: string[];
  canEdit: boolean;
}) {
  const t = useTranslations("properties");
  const tEnum = useTranslations("enums.propertyType");
  const tA11y = useTranslations("common.a11y");
  const locale = useLocale();
  const money = useMoney();
  const num = useNum();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [pinned, setPinned] = useState(new Set(initialPinned));
  const [creating, setCreating] = useState(false);
  const [, start] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return properties
      .filter((p) => p.active)
      .filter((p) => type === "all" || p.propertyType === type)
      .filter((p) => owner === "all" || p.ownerIds.includes(owner))
      .filter(
        (p) =>
          !s ||
          [p.name, p.nameEn ?? "", p.area ?? "", ...p.ownerNames].some((x) =>
            x.toLowerCase().includes(s),
          ),
      )
      .sort(
        (a, b) =>
          Number(pinned.has(b.id)) - Number(pinned.has(a.id)) || a.name.localeCompare(b.name, "ar"),
      );
  }, [properties, q, type, owner, pinned]);

  const togglePin = (id: string) => {
    setPinned((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    start(async () => {
      await togglePinnedProperty(id);
    });
  };

  const pct = (v: number) => num(Math.round(v * 100));

  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        subtitle={t("subtitle", { count: properties.filter((p) => p.active).length })}
        actions={
          canEdit ? (
            <Button onClick={() => setCreating(true)} size="md" className="hidden sm:inline-flex">
              <Plus />
              {t("new")}
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchField
            className="flex-1"
            value={q}
            onValueChange={setQ}
            placeholder={t("search")}
          />
          {owners.length > 1 && (
            <div className="md:w-64">
              <Select
                aria-label={t("filters.owner")}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="all">
                  {t("filters.owner")}: {t("filters.all")}
                </option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <ChipScroller className="mt-3" ariaLabel={t("filters.type")}>
          <IconChip icon={<Building2 />} active={type === "all"} onClick={() => setType("all")}>
            {t("filters.all")}
          </IconChip>
          {(["residential", "investment", "mixed", "industrial"] as const).map((k) => {
            const I = TYPE_ICON[k];
            return (
              <IconChip key={k} icon={<I />} active={type === k} onClick={() => setType(k)}>
                {tEnum(k)}
              </IconChip>
            );
          })}
        </ChipScroller>
      </LargeTitleHeader>

      {properties.length === 0 ? (
        <EmptyState
          illustration={<NoPropertiesIllustration />}
          title={t("empty")}
          description={t("emptyText")}
          action={
            canEdit ? (
              <Button size="lg" onClick={() => setCreating(true)}>
                <Plus />
                {t("new")}
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState illustration={<NoResultsIllustration />} title={t("noResults")} compact />
      ) : (
        <ul data-tour="properties-list" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((p, i) => (
            <li key={p.id}>
              <PropertyPhotoCard
                LinkComponent={Link}
                href={`/properties/${p.id}`}
                name={locale === "en" && p.nameEn ? p.nameEn : p.name}
                location={p.area ?? undefined}
                photo={p.coverUrl}
                priority={i < 3}
                ctaLabel={t("details")}
                pinned={pinned.has(p.id)}
                onTogglePin={() => togglePin(p.id)}
                pinLabel={pinned.has(p.id) ? tA11y("unpin") : tA11y("pin")}
                pills={
                  <>
                    <GlassPill>{t("pills.units", { count: p.unitsCount })}</GlassPill>
                    <GlassPill>{t("pills.occupancy", { pct: pct(p.occupancyRate) })}</GlassPill>
                    {p.expectedFils > 0 && (
                      <GlassPill>
                        <bdi className="num">{money(p.collectedFils, { showCurrency: false })}</bdi>{" "}
                        /{" "}
                        <bdi className="num">
                          {money(p.expectedFils, { compact: p.expectedFils >= 10_000_000 })}
                        </bdi>
                      </GlassPill>
                    )}
                    {p.arrearsFils > 0 && (
                      <GlassPill tone="danger">
                        {t("pills.arrears", { amount: money(p.arrearsFils) })}
                      </GlassPill>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <Button
          onClick={() => setCreating(true)}
          size="icon"
          aria-label={t("new")}
          className="fixed end-5 bottom-[calc(96px+var(--safe-bottom))] z-30 size-14 shadow-[var(--sh-float)] sm:hidden"
        >
          <Plus className="!size-6" />
        </Button>
      )}
      <PropertyFormSheet open={creating} onOpenChange={setCreating} owners={owners} />
    </>
  );
}
