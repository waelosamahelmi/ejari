"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { SearchField } from "@/components/ui/search-field";
import { Chip, ChipScroller, Pill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { NoPaymentsIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { formatDate } from "@/domain/dates";
import { normalizeDigits } from "@/domain/money";
import type { PaymentMethod } from "@/domain/types";
import { cn } from "@/lib/utils";

interface Row { id: string; date: string; receiptNo: string | null; systemNo: string | null; amountFils: number; method: PaymentMethod; voided: boolean; collectorId: string | null; collector: string; tenant: string; unit: string }

export function PaymentsView({ rows, collectorOnly, userId }: { rows: Row[]; collectorOnly: boolean; userId: string; canExport: boolean }) {
  const t = useTranslations("payments");
  const tMethod = useTranslations("enums.paymentMethod");
  const money = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"mine" | "all" | "voided">(collectorOnly ? "mine" : "all");
  const filtered = useMemo(() => {
    const s = normalizeDigits(q).trim().toLowerCase();
    return rows.filter((r) => {
      if (scope === "mine" && r.collectorId !== userId) return false;
      if (scope === "voided" ? !r.voided : r.voided && scope !== "all") return false;
      return !s || [r.receiptNo ?? "", r.systemNo ?? "", r.tenant, r.unit].some((x) => x.toLowerCase().includes(s));
    });
  }, [rows, q, scope, userId]);
  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "date", header: t("columns.date"), cell: (c) => <span className="num">{formatDate(c.row.original.date)}</span> },
    { accessorKey: "receiptNo", header: t("columns.receipt"), cell: (c) => <span className="num font-medium">{c.row.original.receiptNo ?? "—"}</span> },
    { accessorKey: "systemNo", header: t("columns.system"), cell: (c) => <span className="num text-label-2 text-[13px]">{c.row.original.systemNo}</span> },
    { accessorKey: "tenant", header: t("columns.tenant") },
    { accessorKey: "unit", header: t("columns.unit"), cell: (c) => <span className="text-label-2 line-clamp-1">{c.row.original.unit}</span> },
    { accessorKey: "method", header: t("columns.method"), cell: (c) => tMethod(c.row.original.method) },
    { accessorKey: "collector", header: t("columns.collector") },
    { accessorKey: "amountFils", header: t("columns.amount"), meta: { numeric: true }, cell: (c) => <span className={cn("font-semibold", c.row.original.voided && "text-label-3 line-through")}>{money(c.row.original.amountFils)}</span> },
  ];
  return (
    <>
      <LargeTitleHeader title={t("title")}>
        <SearchField value={q} onValueChange={setQ} placeholder={t("search")} />
        <ChipScroller className="mt-3">
          <Chip active={scope === "mine"} onClick={() => setScope("mine")}>{t("mine")}</Chip>
          {!collectorOnly && <Chip active={scope === "all"} onClick={() => setScope("all")}>{t("all")}</Chip>}
          <Chip active={scope === "voided"} onClick={() => setScope("voided")}>{t("voided")}</Chip>
        </ChipScroller>
      </LargeTitleHeader>
      {rows.length === 0 ? (
        <EmptyState illustration={<NoPaymentsIllustration />} title={t("empty")} description={t("emptyText")} />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/payments/${r.id}`)}
          renderCard={(r) => (
            <Link href={`/payments/${r.id}`} className="bg-paper press flex items-center gap-3 rounded-[20px] p-4 shadow-[var(--sh-card)]">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{r.tenant}</div>
                <div className="text-label-2 num truncate text-[13px]">{formatDate(r.date)} · #{r.receiptNo ?? r.systemNo}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("num text-[16px] font-semibold", r.voided && "text-label-3 line-through")}>{money(r.amountFils)}</span>
                {r.voided && <Pill className="bg-red/14 text-red-text">{t("detail.voidedBadge")}</Pill>}
              </div>
            </Link>
          )}
        />
      )}
    </>
  );
}
