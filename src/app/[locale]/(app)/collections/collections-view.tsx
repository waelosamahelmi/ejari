"use client";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  BellRing,
  CloudUpload,
  FileSpreadsheet,
  Gavel,
  HandCoins,
  Lock,
  LockOpen,
  Printer,
  Search,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { MonthPicker } from "@/components/ui/month-picker";
import { Chip, ChipScroller, PeriodStatusPill, Pill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { AlertDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea, Field } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchField } from "@/components/ui/search-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { NoLateUnitsIllustration, NoUnitsIllustration } from "@/components/illustrations";
import { PaymentSheet } from "@/components/domain/payments/payment-sheet";
import { ReminderSheet } from "@/components/domain/payments/reminder-sheet";
import { useMoney, useNum } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { bulkMarkPaid, closeMonth, reopenMonth } from "@/server/actions/payments";
import { formatDate, formatPeriod } from "@/domain/dates";
import type { MonthlyStatement, StatementRow } from "@/domain/reports";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/types";
import { cn } from "@/lib/utils";
import { usePwa } from "@/components/pwa/pwa-provider";
import type { PaymentContext } from "@/server/actions/payments";

type Row = StatementRow & {
  propertyId: string;
  propertyName: string;
  key: string;
  pendingFils: number;
};

export function CollectionsView({
  period,
  today,
  selected,
  properties,
  statements,
  closedAt,
  contracts,
  openPicker,
  offline,
  caps,
}: {
  period: string;
  today: string;
  selected: string;
  properties: { id: string; name: string }[];
  statements: MonthlyStatement[];
  closedAt: string | null;
  contracts: { id: string; label: string }[];
  openPicker: boolean;
  offline: Record<string, PaymentContext>;
  caps: { pay: boolean; close: boolean; reopen: boolean; remind: boolean; export: boolean };
}) {
  const t = useTranslations("collections");
  const tPwa = useTranslations("pwa.outbox");
  const tc = useTranslations("common");
  const tMethod = useTranslations("enums.paymentMethod");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const num = useNum();
  const router = useRouter();
  const pathname = usePathname();
  const { exec, pending } = useAction();
  const [, startNav] = useTransition();
  const [payFor, setPayFor] = useState<string | null>(null);
  const [remindFor, setRemindFor] = useState<string | null>(null);
  const [picker, setPicker] = useState(openPicker);
  const [pickerQ, setPickerQ] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [bulkRows, setBulkRows] = useState<Row[] | null>(null);
  const [bulkReceipts, setBulkReceipts] = useState<Record<string, string>>({});
  const [bulkDate, setBulkDate] = useState(today);
  const [bulkMethod, setBulkMethod] = useState<PaymentMethod>("cash");
  const [confirmClose, setConfirmClose] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const nav = (next: { period?: string; property?: string }) =>
    startNav(() => {
      const p = new URLSearchParams({
        period: next.period ?? period,
        property: next.property ?? selected,
      });
      router.push(`${pathname}?${p.toString()}`);
    });

  // Offline payments waiting in the outbox update balances optimistically (§19.3).
  const { outbox } = usePwa();
  const pendingBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of outbox)
      if (i.input.receivedAt.slice(0, 7) === period)
        m.set(i.input.contractId, (m.get(i.input.contractId) ?? 0) + i.input.amountFils);
    return m;
  }, [outbox, period]);
  const rows: Row[] = useMemo(
    () =>
      statements.flatMap((s) =>
        s.rows
          .map((r) => {
            const pendingFils = (r.contractId && pendingBy.get(r.contractId)) || 0;
            return {
              ...r,
              collectedFils: r.collectedFils + pendingFils,
              arrearsFils: Math.max(0, r.arrearsFils - pendingFils),
              pendingFils,
              propertyId: s.propertyId,
              propertyName: s.propertyName,
              key: `${s.propertyId}:${r.contractId ?? r.unitIds[0]}`,
            };
          })
          .filter((r) => !lateOnly || r.arrearsFils > 0),
      ),
    [statements, lateOnly, pendingBy],
  );
  const pendingTotal = [...pendingBy.values()].reduce((a, b) => a + b, 0);
  const totals = useMemo(() => {
    const t0 = statements.reduce(
      (a, s) => ({
        rent: a.rent + s.totals.rentFils,
        collected: a.collected + s.totals.collectedFils,
        prev: a.prev + s.totals.previousFils,
        next: a.next + s.totals.nextFils,
        arrears: a.arrears + s.totals.arrearsFils,
      }),
      { rent: 0, collected: 0, prev: 0, next: 0, arrears: 0 },
    );
    return {
      ...t0,
      collected: t0.collected + pendingTotal,
      arrears: Math.max(0, t0.arrears - pendingTotal),
    };
  }, [statements, pendingTotal]);
  const closed = !!closedAt;

  const prevNextCell = (r: Row) => (
    <span className="flex flex-col items-end gap-0.5 text-[13px]">
      {r.previousFils > 0 && (
        <span>
          <span className="num">{money(r.previousFils, { showCurrency: false })}</span>{" "}
          <span className="text-label-2">{t("prev")}</span>
        </span>
      )}
      {r.nextFils > 0 && (
        <span>
          <span className="num">{money(r.nextFils, { showCurrency: false })}</span>{" "}
          <span className="text-label-2">{t("next")}</span>
        </span>
      )}
    </span>
  );

  const noteText = (r: Row) =>
    r.notes.map((n) => (n === "free" ? t("free") : n === "notice" ? t("notice") : n)).join(" · ");

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "unitLabels",
      header: t("columns.unit"),
      size: 110,
      cell: (c) => <span className="font-semibold">{c.row.original.unitLabels}</span>,
      sortingFn: (a, b) => a.original.sortOrder - b.original.sortOrder,
    },
    {
      accessorKey: "tenantName",
      header: t("columns.tenant"),
      cell: (c) =>
        c.row.original.vacant ? (
          <span className="text-gray-text">{t("vacant")}</span>
        ) : (
          <span className="line-clamp-2 min-w-32 leading-5">{c.row.original.tenantName}</span>
        ),
    },
    {
      accessorKey: "legalLabel",
      header: t("columns.legal"),
      enableSorting: false,
      cell: (c) =>
        c.row.original.legalStatus !== "none" ? (
          <Pill className="bg-red/14 text-red-text">
            <Gavel className="size-3" />
            {c.row.original.legalLabel}
          </Pill>
        ) : (
          <span className="text-label-3 text-[13px]">{c.row.original.legalLabel}</span>
        ),
    },
    {
      accessorKey: "rentFils",
      header: t("columns.rent"),
      meta: { numeric: true, footer: money(totals.rent, { showCurrency: false }) },
      cell: (c) =>
        c.row.original.vacant ? "" : money(c.row.original.rentFils, { showCurrency: false }),
    },
    {
      id: "receipts",
      header: t("columns.receipts"),
      enableSorting: false,
      cell: (c) => (
        <span className="num text-label-2 text-[13px]">{c.row.original.receiptNos.join(", ")}</span>
      ),
    },
    {
      accessorKey: "collectedFils",
      header: t("columns.collected"),
      meta: { numeric: true, footer: money(totals.collected, { showCurrency: false }) },
      cell: (c) =>
        c.row.original.vacant ? "" : money(c.row.original.collectedFils, { showCurrency: false }),
    },
    {
      id: "prevNext",
      header: t("columns.prevNext"),
      enableSorting: false,
      meta: {
        numeric: true,
        footer:
          totals.prev + totals.next > 0
            ? money(totals.prev + totals.next, { showCurrency: false })
            : "",
      },
      cell: (c) => prevNextCell(c.row.original),
    },
    {
      accessorKey: "lastPaymentDate",
      header: t("columns.lastPayment"),
      cell: (c) => (
        <span className="num text-[13px]">{formatDate(c.row.original.lastPaymentDate)}</span>
      ),
    },
    {
      accessorKey: "arrearsFils",
      header: t("columns.arrears"),
      meta: {
        numeric: true,
        footer: (
          <span className={cn(totals.arrears > 0 && "text-red-text")}>
            {money(totals.arrears, { showCurrency: false })}
          </span>
        ),
      },
      cell: (c) =>
        c.row.original.vacant ? (
          ""
        ) : (
          <span className={cn(c.row.original.arrearsFils > 0 && "text-red-text font-semibold")}>
            {money(c.row.original.arrearsFils, { showCurrency: false })}
          </span>
        ),
    },
    {
      id: "notes",
      header: t("columns.notes"),
      enableSorting: false,
      cell: (c) => (
        <span className="text-label-2 line-clamp-1 text-[13px]">{noteText(c.row.original)}</span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      enableSorting: false,
      cell: (c) => (
        <span className="flex items-center gap-1">
          <PeriodStatusPill status={c.row.original.status} />
          {c.row.original.pendingFils > 0 && (
            <Pill className="bg-indigo/14 text-indigo-text">
              <CloudUpload className="size-3" />
              {tPwa("pendingBadge")}
            </Pill>
          )}
          {caps.remind && c.row.original.arrearsFils > 0 && c.row.original.contractId && (
            <button
              type="button"
              aria-label={t("actions.remind")}
              onClick={(e) => {
                e.stopPropagation();
                setRemindFor(c.row.original.contractId);
              }}
              className="text-label-2 hover:text-label hover:bg-inset flex size-8 items-center justify-center rounded-full"
            >
              <BellRing className="size-4" />
            </button>
          )}
        </span>
      ),
    },
  ];

  const rate = totals.rent > 0 ? Math.round((totals.collected / totals.rent) * 100) : 0;

  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        subtitle={formatPeriod(period, locale)}
        actions={
          <>
            {caps.pay && (
              <Button onClick={() => setPicker(true)} className="hidden sm:inline-flex">
                <HandCoins />
                {t("actions.record")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label={tc("actions.more")}>
                  <Printer />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {statements.map((s) => (
                  <DropdownMenuItem
                    key={s.propertyId}
                    icon={<Printer />}
                    onSelect={() =>
                      window.open(
                        `/print/statement/${s.propertyId}/${period}?lang=${locale}`,
                        "_blank",
                      )
                    }
                  >
                    {t("actions.print")} · {s.propertyName}
                  </DropdownMenuItem>
                ))}
                {caps.export && (
                  <DropdownMenuItem
                    icon={<FileSpreadsheet />}
                    onSelect={() =>
                      (window.location.href = `/api/export/statement?period=${period}&property=${selected}&lang=${locale}`)
                    }
                  >
                    {t("actions.excel")}
                  </DropdownMenuItem>
                )}
                {caps.close && !closed && (
                  <DropdownMenuItem icon={<Lock />} onSelect={() => setConfirmClose(true)}>
                    {t("actions.close")}
                  </DropdownMenuItem>
                )}
                {caps.reopen && closed && (
                  <DropdownMenuItem
                    icon={<LockOpen />}
                    onSelect={() =>
                      exec(() => reopenMonth(period), {
                        success: t("reopenedToast"),
                        onSuccess: () => router.refresh(),
                      })
                    }
                  >
                    {t("actions.reopen")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker value={period} onChange={(p) => nav({ period: p })} />
          {closed && (
            <Pill className="bg-inset text-label-2 h-8 px-3">
              <Lock className="size-3.5" />
              {t("closed")} · {t("closedBy", { date: formatDate(closedAt!.slice(0, 10)) })}
            </Pill>
          )}
        </div>
        <ChipScroller className="mt-3">
          <Chip active={selected === "all"} onClick={() => nav({ property: "all" })}>
            {t("allProperties")}
          </Chip>
          {properties.map((p) => (
            <Chip key={p.id} active={selected === p.id} onClick={() => nav({ property: p.id })}>
              {p.name}
            </Chip>
          ))}
          <span className="bg-separator mx-1 w-px self-stretch" />
          <Chip active={lateOnly} onClick={() => setLateOnly((v) => !v)}>
            {t("filterLate")}
          </Chip>
        </ChipScroller>
      </LargeTitleHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [t("totals.expected"), money(totals.rent), ""],
          [t("totals.collected"), money(totals.collected), "text-green-text"],
          [t("totals.arrears"), money(totals.arrears), totals.arrears > 0 ? "text-red-text" : ""],
          [t("totals.rate"), `${num(rate)}٪`, ""],
        ].map(([l, v, cls]) => (
          <Card key={l} className="p-4">
            <div className="text-label-2 text-[13px]">{l}</div>
            <div className={cn("num mt-0.5 text-[20px] font-semibold", cls)}>{v}</div>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        lateOnly ? (
          <EmptyState illustration={<NoLateUnitsIllustration />} title={t("noLate")} />
        ) : (
          <EmptyState
            illustration={<NoUnitsIllustration />}
            title={t("empty")}
            description={t("emptyText")}
          />
        )
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(r) => r.key}
          showFooter
          selectable={caps.pay && !closed}
          density="compact"
          maxHeight="calc(100dvh - 300px)"
          groupBy={selected === "all" ? (r) => r.propertyName : undefined}
          groupLabel={(k, rs) => (
            <span className="flex justify-between">
              <span>{k}</span>
              <span className="num">{money(rs.reduce((a, r) => a + r.collectedFils, 0))}</span>
            </span>
          )}
          onRowClick={(r) =>
            r.contractId && caps.pay && !closed ? setPayFor(r.contractId) : undefined
          }
          rowClassName={(r) => (r.vacant ? "text-label-2" : undefined)}
          bulkBar={(sel, clear) => (
            <Button
              size="sm"
              variant="white"
              onClick={() => {
                setBulkRows(sel.filter((r) => r.contractId && !r.vacant));
                clear();
              }}
            >
              {t("actions.markPaid")}
            </Button>
          )}
          renderCard={(r) => (
            <button
              type="button"
              disabled={!r.contractId || !caps.pay || closed}
              onClick={() => r.contractId && setPayFor(r.contractId)}
              className="bg-paper press flex min-h-[76px] w-full items-center gap-3 rounded-[20px] p-4 text-start shadow-[var(--sh-card)] disabled:opacity-80"
            >
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-semibold",
                  r.vacant ? "bg-gray/16 text-gray-text" : "bg-inset",
                )}
              >
                {r.unitLabels.length > 4 ? r.unitLabels.slice(0, 4) : r.unitLabels}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">
                  {r.vacant ? t("vacant") : r.tenantName}
                </span>
                <span className="text-label-2 block truncate text-[13px]">
                  {selected === "all" ? `${r.propertyName} · ` : ""}
                  {r.unitLabels}
                </span>
              </span>
              {!r.vacant && (
                <span className="flex flex-col items-end gap-1">
                  {r.pendingFils > 0 ? (
                    <Pill className="bg-indigo/14 text-indigo-text">
                      <CloudUpload className="size-3" />
                      {tPwa("pendingBadge")}
                    </Pill>
                  ) : (
                    <PeriodStatusPill status={r.status} />
                  )}
                  <span
                    className={cn(
                      "num text-[15px] font-semibold",
                      r.arrearsFils > 0 && "text-red-text",
                    )}
                  >
                    {money(r.arrearsFils > 0 ? r.arrearsFils : r.collectedFils)}
                  </span>
                </span>
              )}
            </button>
          )}
        />
      )}

      {caps.pay && (
        <Button
          onClick={() => setPicker(true)}
          size="icon"
          aria-label={t("actions.record")}
          className="fixed end-5 bottom-[calc(96px+var(--safe-bottom))] z-30 size-14 shadow-[var(--sh-float)] sm:hidden"
        >
          <HandCoins className="!size-6" />
        </Button>
      )}

      <PaymentSheet
        open={!!payFor}
        onOpenChange={(o) => !o && setPayFor(null)}
        contractId={payFor}
        offlineContext={payFor ? (offline[payFor] ?? null) : null}
      />
      <ReminderSheet
        open={!!remindFor}
        onOpenChange={(o) => !o && setRemindFor(null)}
        contractId={remindFor}
      />

      <Sheet open={picker} onOpenChange={setPicker} title={t("pickContract")}>
        <SearchField
          value={pickerQ}
          onValueChange={setPickerQ}
          placeholder={t("pickContractHint")}
          autoFocus
        />
        <ul className="bg-paper divide-separator mt-3 divide-y-[0.5px] overflow-hidden rounded-[20px]">
          {contracts
            .filter((c) => !pickerQ || c.label.includes(pickerQ))
            .slice(0, 40)
            .map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="hover:bg-paper-2 flex w-full items-center gap-3 px-4 py-3 text-start text-[15px]"
                  onClick={() => {
                    setPicker(false);
                    setPayFor(c.id);
                  }}
                >
                  <Search className="text-label-3 size-4" />
                  {c.label}
                </button>
              </li>
            ))}
        </ul>
      </Sheet>

      <Sheet
        open={!!bulkRows}
        onOpenChange={(o) => !o && setBulkRows(null)}
        title={t("bulk.title")}
        description={t("bulk.text")}
        size="lg"
        footer={
          <Button
            block
            size="lg"
            loading={pending}
            onClick={() =>
              exec(
                () =>
                  bulkMarkPaid({
                    rows: (bulkRows ?? []).map((r) => ({
                      contractId: r.contractId!,
                      receiptNo: bulkReceipts[r.contractId!] || null,
                    })),
                    receivedAt: bulkDate,
                    method: bulkMethod,
                    period,
                  }),
                {
                  onSuccess: (res) => {
                    toast.success(t("bulk.done", { count: res.filter((x) => x.ok).length }));
                    setBulkRows(null);
                    setBulkReceipts({});
                    router.refresh();
                  },
                },
              )
            }
          >
            {t("actions.markPaid")}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("bulk.date")} htmlFor="bk-date">
              <DatePicker id="bk-date" value={bulkDate} onChange={(d) => d && setBulkDate(d)} />
            </Field>
            <Field label={t("bulk.method")}>
              <SegmentedControl
                size="sm"
                options={PAYMENT_METHODS.slice(0, 4).map((m) => ({ value: m, label: tMethod(m) }))}
                value={bulkMethod}
                onChange={setBulkMethod}
              />
            </Field>
          </div>
          <table className="bg-paper w-full overflow-hidden rounded-[16px] text-[14px]">
            <thead>
              <tr className="text-label-2 border-separator border-b-[0.5px] text-[12px]">
                <th className="px-3 py-2 text-start">{t("columns.unit")}</th>
                <th className="px-3 py-2 text-start">{t("columns.tenant")}</th>
                <th className="px-3 py-2 text-end">{t("columns.arrears")}</th>
                <th className="px-3 py-2 text-start">{t("bulk.receipt")}</th>
              </tr>
            </thead>
            <tbody>
              {(bulkRows ?? []).map((r) => (
                <Fragment key={r.key}>
                  <tr className="border-separator border-b-[0.5px] last:border-0">
                    <td className="px-3 py-2 font-semibold">{r.unitLabels}</td>
                    <td className="px-3 py-2">{r.tenantName}</td>
                    <td className="num px-3 py-2 text-end">
                      {money(
                        Math.max(
                          r.arrearsFils,
                          r.rentFils - r.collectedFils > 0 ? r.rentFils - r.collectedFils : 0,
                        ),
                        { showCurrency: false },
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        aria-label={t("bulk.receipt")}
                        dir="ltr"
                        inputMode="numeric"
                        className="num h-10 w-28"
                        value={bulkReceipts[r.contractId!] ?? ""}
                        onChange={(e) =>
                          setBulkReceipts((m) => ({ ...m, [r.contractId!]: e.target.value }))
                        }
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Sheet>

      <AlertDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t("closeConfirm", { month: formatPeriod(period, locale) })}
        description={t("closeText")}
        confirmLabel={t("actions.close")}
        cancelLabel={tc("actions.cancel")}
        loading={pending}
        onConfirm={() =>
          exec(() => closeMonth(period, closeNote || null), {
            success: t("closedToast"),
            onSuccess: () => {
              setConfirmClose(false);
              router.refresh();
            },
          })
        }
      >
        <Textarea
          aria-label={tc("labels.notes")}
          placeholder={tc("labels.notes")}
          rows={2}
          value={closeNote}
          onChange={(e) => setCloseNote(e.target.value)}
        />
      </AlertDialog>
    </>
  );
}
