"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { MessageCircle, Phone, Plus, SlidersHorizontal } from "lucide-react";
import { SwipeActions } from "@/components/ui/swipe-actions";
import { whatsappLink } from "@/domain/validation";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter, Link } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { SearchField } from "@/components/ui/search-field";
import { Chip, ChipScroller, Pill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { HistogramRangeSlider } from "@/components/ui/histogram-range-slider";
import { NoResultsIllustration, NoTenantsIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { normalizeDigits } from "@/domain/money";
import { cn } from "@/lib/utils";

// Sheets are code-split: they load after hydration instead of with the page.
const TenantFormSheet = dynamic(
  () => import("@/components/domain/tenants/tenant-form").then((m) => m.TenantFormSheet),
  { ssr: false },
);

export interface TenantRow {
  id: string;
  name: string;
  civilIdMasked: string;
  phone: string | null;
  units: string[];
  arrearsFils: number;
  creditFils: number;
  daysLate: number;
  active: boolean;
  blacklisted: boolean;
}

type Filter = "all" | "late" | "active" | "blacklisted";

export function TenantsView({ rows, canEdit }: { rows: TenantRow[]; canEdit: boolean }) {
  const t = useTranslations("tenants");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const maxArrears = Math.max(1000, ...rows.map((r) => r.arrearsFils));
  const [range, setRange] = useState<[number, number]>([0, maxArrears]);
  const rangeActive = range[0] > 0 || range[1] < maxArrears;

  const filtered = useMemo(() => {
    const s = normalizeDigits(q).trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "late" && r.arrearsFils <= 0) return false;
      if (filter === "active" && !r.active) return false;
      if (filter === "blacklisted" && !r.blacklisted) return false;
      if (rangeActive && (r.arrearsFils < range[0] || r.arrearsFils > range[1])) return false;
      if (!s) return true;
      return (
        r.name.toLowerCase().includes(s) ||
        (r.phone ?? "").includes(s) ||
        r.civilIdMasked.replace(/•/g, "").includes(s) ||
        r.units.some((u) => u.toLowerCase().includes(s))
      );
    });
  }, [rows, q, filter, range, rangeActive]);

  const status = (r: TenantRow) =>
    r.blacklisted ? (
      <Pill className="bg-ink text-on-ink">{t("blacklist.badge")}</Pill>
    ) : r.arrearsFils > 0 ? (
      <Pill className="bg-red/14 text-red-text" dot="bg-red">
        {t("status.late")}
      </Pill>
    ) : !r.active ? (
      <Pill className="bg-gray/16 text-gray-text">{t("status.noContract")}</Pill>
    ) : r.creditFils > 0 ? (
      <Pill className="bg-indigo/14 text-indigo-text" dot="bg-indigo">
        {t("status.credit")}
      </Pill>
    ) : (
      <Pill className="bg-green/14 text-green-text" dot="bg-green">
        {t("status.clear")}
      </Pill>
    );

  const columns: ColumnDef<TenantRow, unknown>[] = [
    {
      accessorKey: "name",
      header: t("columns.name"),
      cell: (c) => <span className="font-medium">{c.row.original.name}</span>,
    },
    {
      accessorKey: "civilIdMasked",
      header: t("columns.civilId"),
      cell: (c) => <span className="num text-label-2">{c.row.original.civilIdMasked}</span>,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: "phone",
      header: t("columns.phone"),
      cell: (c) => (
        <span className="num text-label-2" dir="ltr">
          {c.row.original.phone}
        </span>
      ),
    },
    {
      id: "units",
      header: t("columns.units"),
      enableSorting: false,
      cell: (c) => (
        <span className="text-label-2 line-clamp-1 text-[14px]">
          {c.row.original.units.join(" · ")}
        </span>
      ),
    },
    {
      accessorKey: "arrearsFils",
      header: t("columns.balance"),
      meta: { numeric: true },
      cell: (c) => {
        const r = c.row.original;
        return (
          <span
            className={cn(
              r.arrearsFils > 0
                ? "text-red-text font-semibold"
                : r.creditFils > 0
                  ? "text-indigo-text"
                  : "text-label-2",
            )}
          >
            {r.arrearsFils > 0
              ? money(r.arrearsFils)
              : r.creditFils > 0
                ? `+${money(r.creditFils)}`
                : money(0)}
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("columns.status"),
      enableSorting: false,
      cell: (c) => status(c.row.original),
    },
  ];

  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        subtitle={tc("labels.results", { count: rows.length })}
        actions={
          canEdit ? (
            <Button className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
              <Plus />
              {t("new")}
            </Button>
          ) : undefined
        }
      >
        <div className="flex items-center gap-2">
          <SearchField
            className="flex-1"
            value={q}
            onValueChange={setQ}
            placeholder={t("search")}
          />
          <button
            type="button"
            aria-label={tc("actions.filters")}
            onClick={() => setFilterSheet(true)}
            className={cn(
              "press relative flex size-[52px] shrink-0 items-center justify-center rounded-full shadow-[0_1px_2px_rgba(16,24,40,.05)]",
              rangeActive ? "bg-ink text-on-ink" : "bg-paper",
            )}
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </div>
        <ChipScroller className="mt-3">
          {(["all", "late", "active", "blacklisted"] as const).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {t(`filters.${f}`)}
            </Chip>
          ))}
        </ChipScroller>
      </LargeTitleHeader>
      {rows.length === 0 ? (
        <EmptyState
          illustration={<NoTenantsIllustration />}
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
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/tenants/${r.id}`)}
          empty={
            <EmptyState compact illustration={<NoResultsIllustration />} title={t("noResults")} />
          }
          renderCard={(r) => (
            <SwipeActions
              actions={
                r.phone
                  ? [
                      {
                        label: tc("actions.call"),
                        icon: <Phone />,
                        tone: "green",
                        href: `tel:+965${r.phone}`,
                      },
                      {
                        label: tc("actions.whatsapp"),
                        icon: <MessageCircle />,
                        tone: "ink",
                        href: whatsappLink(r.phone, ""),
                      },
                    ]
                  : []
              }
            >
              <Link
                href={`/tenants/${r.id}`}
                className="bg-paper press flex items-center gap-3 rounded-[20px] p-4 shadow-[var(--sh-card)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{r.name}</div>
                  <div className="text-label-2 truncate text-[13px]">
                    {r.units.join(" · ") || r.phone}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {status(r)}
                  {r.arrearsFils > 0 && (
                    <span className="num text-red-text text-[14px] font-semibold">
                      {money(r.arrearsFils)}
                    </span>
                  )}
                </div>
              </Link>
            </SwipeActions>
          )}
        />
      )}
      <Sheet
        open={filterSheet}
        onOpenChange={setFilterSheet}
        title={tc("actions.filters")}
        footer={
          <Button block size="lg" onClick={() => setFilterSheet(false)}>
            {tc("actions.showResults", { count: filtered.length })}
          </Button>
        }
      >
        <div className="space-y-2">
          <div className="text-[15px] font-semibold">{t("columns.balance")}</div>
          <HistogramRangeSlider
            values={rows.map((r) => r.arrearsFils)}
            min={0}
            max={maxArrears}
            step={1000}
            value={range}
            onChange={setRange}
            format={(v) => money(v, { showCurrency: false })}
            labels={{ min: tc("labels.from"), max: tc("labels.to") }}
          />
          <Button variant="plain" onClick={() => setRange([0, maxArrears])}>
            {tc("actions.reset")}
          </Button>
        </div>
      </Sheet>
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
      <TenantFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSaved={(r) => router.push(`/tenants/${r.id}`)}
      />
    </>
  );
}
