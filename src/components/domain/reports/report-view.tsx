"use client";
import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight, FileSpreadsheet, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthPicker } from "@/components/ui/month-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { HistogramRangeSlider } from "@/components/ui/histogram-range-slider";
import { NoResultsIllustration } from "@/components/illustrations";
import { useMoney, useNum } from "@/components/shell/prefs-context";
import { formatDate } from "@/domain/dates";
import type { Cell, RCol, ReportParams, ReportSpec } from "@/server/reports/build";
import { cn } from "@/lib/utils";

const AccountingChart = dynamic(() => import("./accounting-chart"), { ssr: false, loading: () => <Skeleton className="h-[260px]" /> });

type Row = Record<string, Cell>;

export function ReportView({
  spec,
  params: p,
  query,
  options,
}: {
  spec: ReportSpec;
  params: ReportParams;
  query: string;
  options: { properties: { id: string; name: string }[]; owners: { id: string; name: string }[]; tenants: { id: string; name: string }[] };
  canRemind: boolean;
}) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const num = useNum();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const maxAsk = Math.max(1000, ...(spec.vacantAsking ?? [0]));
  const [askRange, setAskRange] = useState<[number, number]>([0, maxAsk]);

  const set = (patch: Partial<Record<keyof ReportParams, string | null>>) =>
    start(() => {
      const q = new URLSearchParams(query);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") q.delete(k);
        else q.set(k, v);
      }
      router.push(`${pathname}?${q.toString()}`);
    });

  const fmt = (c: RCol, v: Cell) => {
    if (v === null || v === undefined || v === "") return "";
    switch (c.type) {
      case "money":
        return money(Number(v), { showCurrency: false });
      case "date":
        return formatDate(String(v));
      case "pct":
        return `${num(Math.round(Number(v) * 1000) / 10)}٪`;
      case "int":
        return num(Number(v));
      case "bool":
        return v ? t("yes") : t("no");
      default:
        return String(v);
    }
  };

  const kpiValue = (k: ReportSpec["kpis"][number]) =>
    k.type === "money" ? money(k.value) : k.type === "pct" ? `${num(Math.round(k.value * 1000) / 10)}٪` : k.type === "days" ? tc("labels.days", { count: k.value }) : num(k.value);

  const presets = ["this_month", "last_month", "this_quarter", "last_quarter", "h1", "h2", "this_year", "last_year", "custom"] as const;
  const usesRange = ["accounting", "owner", "expenses"].includes(spec.type);
  const usesPeriod = ["statement", "summary"].includes(spec.type);
  const usesAsOf = ["late", "vacant", "ledger"].includes(spec.type);
  const usesProperty = ["statement", "late", "vacant", "accounting", "expiring", "expenses", "grace"].includes(spec.type);
  const usesOwner = ["summary", "accounting", "owner"].includes(spec.type);

  const rowHref = (r: Row) => (r._contractId ? `/contracts/${String(r._contractId)}` : r._unitId ? `/units/${String(r._unitId)}` : null);

  const sections = useMemo(
    () =>
      spec.sections.map((s) =>
        spec.type === "vacant" && (askRange[0] > 0 || askRange[1] < maxAsk) ? { ...s, rows: s.rows.filter((r) => Number(r.asking) >= askRange[0] && Number(r.asking) <= askRange[1]) } : s,
      ),
    [spec, askRange, maxAsk],
  );

  return (
    <>
      <LargeTitleHeader
        title={spec.title}
        subtitle={spec.subtitle}
        back={{ href: "/reports", label: t("title") }}
        actions={
          <>
            <Button asChild variant="secondary" size="icon" aria-label={tc("actions.print")}>
              <a href={`/print/report/${spec.type}?${query}&lang=${locale}`} target="_blank" rel="noreferrer"><Printer /></a>
            </Button>
            <Button asChild variant="secondary" size="icon" aria-label={tc("actions.exportExcel")}>
              <a href={`/api/export/report/${spec.type}?${query}&lang=${locale}`}><FileSpreadsheet /></a>
            </Button>
          </>
        }
      >
        <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
          {usesPeriod && <MonthPicker value={p.period} onChange={(v) => set({ period: v })} />}
          {usesAsOf && (
            <div className="w-48"><DatePicker value={p.asOf} onChange={(d) => d && set({ asOf: d })} /></div>
          )}
          {usesProperty && (
            <div className="w-56">
              <Select aria-label={t("params.property")} value={p.property ?? ""} onChange={(e) => set({ property: e.target.value || null })}>
                {spec.type !== "statement" && <option value="">{t("params.property")}: {t("params.all")}</option>}
                {options.properties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </div>
          )}
          {usesOwner && (
            <div className="w-56">
              <Select aria-label={t("params.owner")} value={p.owner ?? ""} onChange={(e) => set({ owner: e.target.value || null })}>
                {spec.type !== "owner" && <option value="">{t("params.owner")}: {t("params.all")}</option>}
                {options.owners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </div>
          )}
          {spec.type === "ledger" && (
            <div className="w-64">
              <Select aria-label={t("params.tenant")} value={p.tenant ?? ""} onChange={(e) => set({ tenant: e.target.value || null })}>
                <option value="">{t("params.chooseTenant")}</option>
                {options.tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </div>
          )}
          {spec.type === "expiring" && (
            <SegmentedControl fill={false} options={[30, 60, 90].map((d) => ({ value: String(d), label: t("params.days", { n: d }) }))} value={String(p.days)} onChange={(v) => set({ days: v })} />
          )}
          {spec.type === "expenses" && (
            <SegmentedControl fill={false} size="sm" options={(["category", "property", "beneficiary", "period"] as const).map((g) => ({ value: g, label: t(`groupBy.${g}`) }))} value={p.groupBy} onChange={(v) => set({ groupBy: v })} />
          )}
          {spec.type === "accounting" && (
            <label className="bg-paper flex h-11 items-center gap-2 rounded-full ps-4 pe-1.5 text-[14px]">
              {t("params.compare")}
              <Toggle checked={p.compare} onCheckedChange={(v) => set({ compare: v ? "1" : "0" })} ariaLabel={t("params.compare")} />
            </label>
          )}
        </div>
        {usesRange && (
          <>
            <ChipScroller className="mt-3">
              {presets.map((x) => (
                <Chip key={x} active={p.preset === x} onClick={() => set({ preset: x })}>{t(`presets.${x}`)}</Chip>
              ))}
            </ChipScroller>
            {p.preset === "custom" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-label-2 text-[14px]">{t("params.from")}</span>
                <MonthPicker value={p.from} onChange={(v) => set({ from: v })} />
                <span className="text-label-2 text-[14px]">{t("params.to")}</span>
                <MonthPicker value={p.to} onChange={(v) => set({ to: v })} />
              </div>
            )}
          </>
        )}
      </LargeTitleHeader>

      {spec.kpis.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {spec.kpis.map((k) => {
            const up = k.delta && k.delta.delta > 0;
            const good = k.delta ? (k.lowerIsBetter ? !up : up) : null;
            return (
              <Card key={k.label} className="p-4">
                <div className="text-label-2 line-clamp-2 min-h-8 text-[12px] leading-4">{k.label}</div>
                <div className={cn("num mt-1 text-[18px] font-semibold", k.tone === "red" && "text-red-text", k.tone === "green" && "text-green-text", k.tone === "orange" && "text-orange-text")}>{kpiValue(k)}</div>
                {k.delta && k.delta.delta !== 0 && (
                  <div className={cn("mt-1 flex items-center gap-0.5 text-[12px] font-medium", good ? "text-green-text" : "text-red-text")}>
                    {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                    <span className="num">{k.delta.pct === null ? "—" : `${num(Math.round(Math.abs(k.delta.pct) * 1000) / 10)}٪`}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {spec.chart && spec.chart.length > 0 && (
        <Card className="mb-5 p-5">
          <h2 className="text-label-2 mb-3 text-[14px] font-semibold">{t("sections.chart")}</h2>
          <AccountingChart data={spec.chart} labels={{ collected: t("cols.collected"), arrears: t("cols.arrears"), occupancy: t("cols.occupancy") }} format={(f) => money(f)} />
        </Card>
      )}

      {spec.type === "vacant" && spec.vacantAsking && spec.vacantAsking.length > 1 && (
        <Card className="mb-5 p-5">
          <h2 className="text-label-2 text-[14px] font-semibold">{t("vacantFilter")}</h2>
          <HistogramRangeSlider values={spec.vacantAsking} min={0} max={maxAsk} step={5000} value={askRange} onChange={setAskRange} format={(v) => money(v, { showCurrency: false })} labels={{ min: t("params.from"), max: t("params.to") }} />
        </Card>
      )}

      <div className="space-y-6">
        {sections.map((s, si) => {
          const columns: ColumnDef<Row, unknown>[] = s.columns.map((c) => ({
            id: c.key,
            accessorFn: (r) => r[c.key],
            header: c.header,
            meta: {
              numeric: c.type === "money" || c.type === "int" || c.type === "pct",
              footer: s.totals && s.totals[c.key] !== undefined ? <span>{fmt(c, s.totals[c.key]!)}</span> : undefined,
            },
            cell: (x) => {
              const v = x.getValue() as Cell;
              return <span className={cn(c.key === "arrears" || c.key === "amount" ? (Number(v) > 0 && spec.type === "late" ? "text-red-text font-semibold" : "") : "", c.key === "balance" && Number(v) > 0 && "text-red-text")}>{fmt(c, v)}</span>;
            },
          }));
          return (
            <section key={si} className="min-w-0">
              {s.title && <h2 className="mb-3 text-[20px] font-semibold">{s.title}</h2>}
              {s.rows.length === 0 ? (
                <EmptyState compact illustration={<NoResultsIllustration />} title={t("empty")} />
              ) : (
                <DataTable
                  data={s.rows}
                  columns={columns}
                  showFooter={!!s.totals}
                  density="compact"
                  maxHeight="70vh"
                  groupBy={s.groupKey && !p.property ? (r) => String(r[s.groupKey!] ?? "") : undefined}
                  onRowClick={(r) => {
                    const h = rowHref(r);
                    if (h) router.push(h);
                  }}
                />
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
