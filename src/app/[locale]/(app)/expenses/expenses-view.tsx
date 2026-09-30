"use client";
import { useMemo, useState } from "react";
import { Plus, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { SearchField } from "@/components/ui/search-field";
import { Chip, ChipScroller, Pill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { NoExpensesIllustration, NoResultsIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { formatDate } from "@/domain/dates";
import { cn } from "@/lib/utils";

interface Row { id: string; no: string; date: string; recipient: string; status: "draft" | "posted" | "void"; total: number; lines: string[]; categoryIds: string[]; propertyIds: string[]; propertyNames: string[] }
const STATUS_CLS = { draft: "bg-inset text-label-2", posted: "bg-green/14 text-green-text", void: "bg-red/14 text-red-text" } as const;

export function ExpensesView({ rows, canCreate, categories, properties }: { rows: Row[]; canCreate: boolean; categories: { id: string; name: string }[]; properties: { id: string; name: string }[] }) {
  const t = useTranslations("expenses");
  const tStatus = useTranslations("enums.voucherStatus");
  const money = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Row["status"]>("all");
  const [prop, setProp] = useState("all");
  const [cat, setCat] = useState("all");
  const [month, setMonth] = useState("all");
  const months = useMemo(() => [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (prop === "all" || r.propertyIds.includes(prop)) &&
      (cat === "all" || r.categoryIds.includes(cat)) &&
      (month === "all" || r.date.startsWith(month)) &&
      (!q || [r.no, r.recipient, ...r.lines].some((x) => x.includes(q))),
  );
  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "no", header: t("columns.no"), cell: (c) => <span className="num font-medium">{c.row.original.no}</span> },
    { accessorKey: "date", header: t("columns.date"), cell: (c) => <span className="num">{formatDate(c.row.original.date)}</span> },
    { id: "lines", header: t("columns.lines"), enableSorting: false, cell: (c) => <span className="text-label-2 line-clamp-2 text-[14px]">{c.row.original.lines.join(" | ")}</span> },
    { id: "props", header: t("columns.properties"), enableSorting: false, cell: (c) => <span className="text-[14px]">{c.row.original.propertyNames.join("، ")}</span> },
    { accessorKey: "total", header: t("columns.total"), meta: { numeric: true, footer: money(filtered.filter((r) => r.status === "posted").reduce((a, r) => a + r.total, 0)) }, cell: (c) => <span className={cn("font-semibold", c.row.original.status === "void" && "text-label-3 line-through")}>{money(c.row.original.total)}</span> },
    { accessorKey: "status", header: t("columns.status"), cell: (c) => <Pill className={STATUS_CLS[c.row.original.status]}>{tStatus(c.row.original.status)}</Pill> },
  ];
  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        actions={
          canCreate ? (
            <>
              <Button asChild variant="secondary" size="icon" aria-label={t("recurring")}><Link href="/expenses/recurring"><Repeat /></Link></Button>
              <Button asChild><Link href="/expenses/new"><Plus />{t("new")}</Link></Button>
            </>
          ) : undefined
        }
      >
        <SearchField value={q} onValueChange={setQ} placeholder={t("search")} />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select aria-label={t("filters.period")} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="all">{t("filters.period")}: {t("filters.all")}</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select aria-label={t("filters.property")} value={prop} onChange={(e) => setProp(e.target.value)}>
            <option value="all">{t("filters.property")}: {t("filters.all")}</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select aria-label={t("filters.category")} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">{t("filters.category")}: {t("filters.all")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <ChipScroller className="mt-3">
          {(["all", "posted", "draft", "void"] as const).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{t(`filters.${s}`)}</Chip>
          ))}
        </ChipScroller>
      </LargeTitleHeader>
      {rows.length === 0 ? (
        <EmptyState illustration={<NoExpensesIllustration />} title={t("empty")} description={t("emptyText")} action={canCreate ? <Button asChild size="lg"><Link href="/expenses/new"><Plus />{t("new")}</Link></Button> : undefined} />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          showFooter
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/expenses/${r.id}`)}
          empty={<EmptyState compact illustration={<NoResultsIllustration />} title={t("noResults")} />}
          renderCard={(r) => (
            <Link href={`/expenses/${r.id}`} className="bg-paper press block rounded-[20px] p-4 shadow-[var(--sh-card)]">
              <div className="flex items-center justify-between">
                <span className="num font-semibold">{r.no}</span>
                <Pill className={STATUS_CLS[r.status]}>{tStatus(r.status)}</Pill>
              </div>
              <div className="text-label-2 mt-1 line-clamp-2 text-[13px]">{r.lines.join(" | ")}</div>
              <div className="mt-2 flex justify-between text-[14px]"><span className="num text-label-2">{formatDate(r.date)}</span><span className="num font-semibold">{money(r.total)}</span></div>
            </Link>
          )}
        />
      )}
    </>
  );
}
