"use client";
import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { MonthPicker } from "@/components/ui/month-picker";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PeriodStatusPill } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/components/shell/prefs-context";
import { getStatement } from "@/server/actions/statements";
import { formatDate } from "@/domain/dates";
import type { MonthlyStatement, StatementRow } from "@/domain/reports";
import { cn } from "@/lib/utils";

/** Monthly statement embedded in the property page, with month picker, print and Excel. */
export function StatementEmbed({
  propertyId,
  initialPeriod,
  canExport,
}: {
  propertyId: string;
  initialPeriod: string;
  canExport: boolean;
}) {
  const t = useTranslations("collections");
  const locale = useLocale();
  const money = useMoney();
  const [period, setPeriod] = useState(initialPeriod);
  const [s, setS] = useState<MonthlyStatement | null>(null);
  useEffect(() => {
    setS(null);
    void getStatement(propertyId, period).then((r) => r.ok && setS(r.data));
  }, [propertyId, period]);
  const f = (v: number) => money(v, { showCurrency: false });
  const columns: ColumnDef<StatementRow, unknown>[] = [
    {
      accessorKey: "unitLabels",
      header: t("columns.unit"),
      cell: (c) => <span className="font-semibold">{c.row.original.unitLabels}</span>,
      enableSorting: false,
    },
    {
      accessorKey: "tenantName",
      header: t("columns.tenant"),
      enableSorting: false,
      cell: (c) =>
        c.row.original.vacant ? (
          <span className="text-gray-text">{t("vacant")}</span>
        ) : (
          c.row.original.tenantName
        ),
    },
    {
      accessorKey: "legalLabel",
      header: t("columns.legal"),
      enableSorting: false,
      cell: (c) => <span className="text-label-2 text-[13px]">{c.row.original.legalLabel}</span>,
    },
    {
      accessorKey: "rentFils",
      header: t("columns.rent"),
      enableSorting: false,
      meta: { numeric: true, footer: s ? f(s.totals.rentFils) : "" },
      cell: (c) => (c.row.original.vacant ? "" : f(c.row.original.rentFils)),
    },
    {
      id: "r",
      header: t("columns.receipts"),
      enableSorting: false,
      cell: (c) => (
        <span className="num text-label-2 text-[13px]">{c.row.original.receiptNos.join(", ")}</span>
      ),
    },
    {
      accessorKey: "collectedFils",
      header: t("columns.collected"),
      enableSorting: false,
      meta: { numeric: true, footer: s ? f(s.totals.collectedFils) : "" },
      cell: (c) => (c.row.original.vacant ? "" : f(c.row.original.collectedFils)),
    },
    {
      id: "pn",
      header: t("columns.prevNext"),
      enableSorting: false,
      meta: { numeric: true },
      cell: (c) => (
        <span className="text-[13px]">
          {c.row.original.previousFils ? `${f(c.row.original.previousFils)} ${t("prev")}` : ""}
          {c.row.original.nextFils ? ` ${f(c.row.original.nextFils)} ${t("next")}` : ""}
        </span>
      ),
    },
    {
      accessorKey: "lastPaymentDate",
      header: t("columns.lastPayment"),
      enableSorting: false,
      cell: (c) => (
        <span className="num text-[13px]">{formatDate(c.row.original.lastPaymentDate)}</span>
      ),
    },
    {
      accessorKey: "arrearsFils",
      header: t("columns.arrears"),
      enableSorting: false,
      meta: {
        numeric: true,
        footer: s ? (
          <span className={cn(s.totals.arrearsFils > 0 && "text-red-text")}>
            {f(s.totals.arrearsFils)}
          </span>
        ) : (
          ""
        ),
      },
      cell: (c) =>
        c.row.original.vacant ? (
          ""
        ) : (
          <span className={cn(c.row.original.arrearsFils > 0 && "text-red-text font-semibold")}>
            {f(c.row.original.arrearsFils)}
          </span>
        ),
    },
    {
      id: "st",
      header: t("columns.status"),
      enableSorting: false,
      cell: (c) => <PeriodStatusPill status={c.row.original.status} />,
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={period} onChange={setPeriod} />
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <a
              href={`/print/statement/${propertyId}/${period}?lang=${locale}`}
              target="_blank"
              rel="noreferrer"
            >
              <Printer />
              {t("actions.print")}
            </a>
          </Button>
          {canExport && (
            <Button asChild variant="secondary" size="sm">
              <a
                href={`/api/export/statement?period=${period}&property=${propertyId}&lang=${locale}`}
              >
                <FileSpreadsheet />
                {t("actions.excel")}
              </a>
            </Button>
          )}
        </div>
      </div>
      {s ? (
        <DataTable
          data={s.rows}
          columns={columns}
          showFooter
          maxHeight="none"
          getRowId={(r) => r.contractId ?? r.unitIds[0]!}
        />
      ) : (
        <Skeleton className="h-96" />
      )}
    </div>
  );
}
