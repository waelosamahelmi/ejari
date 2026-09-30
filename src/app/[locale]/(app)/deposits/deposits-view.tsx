"use client";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Plus, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { MonthPicker } from "@/components/ui/month-picker";
import { DataTable } from "@/components/ui/data-table";
import { Sheet } from "@/components/ui/sheet";
import { AlertDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/segmented";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { NoPaymentsIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { deleteDeposit, saveDeposit, saveReconciliationNote } from "@/server/actions/expenses";
import { formatDate, formatPeriod, todayKuwait } from "@/domain/dates";
import type { MonthlySummary, SummaryPropertyRow } from "@/domain/reports";
import { cn } from "@/lib/utils";

interface Dep {
  id: string;
  date: string;
  amountFils: number;
  destination: "owner_bank" | "office_bank" | "cash_to_owner";
  ownerId: string | null;
  owner: string;
  bankName: string;
  reference: string;
  notes: string;
  properties: { propertyId: string; amountFils: number; name: string }[];
}

export function DepositsView({
  tab: initialTab,
  period,
  owner,
  owners,
  properties,
  summary,
  note: initialNote,
  deposits,
  canManage,
}: {
  tab: "summary" | "list";
  period: string;
  owner: string | null;
  owners: { id: string; name: string }[];
  properties: { id: string; name: string }[];
  summary: MonthlySummary;
  note: string;
  deposits: Dep[];
  canManage: boolean;
}) {
  const t = useTranslations("deposits");
  const tc = useTranslations("common");
  const tDest = useTranslations("enums.depositDestination");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const pathname = usePathname();
  const { exec, pending } = useAction();
  const [, nav] = useTransition();
  const [tab, setTab] = useState(initialTab);
  const [note, setNote] = useState(initialNote);
  const [edit, setEdit] = useState<Dep | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const go = (p: { period?: string; owner?: string | null }) =>
    nav(() => {
      const q = new URLSearchParams({ period: p.period ?? period, tab });
      const o = p.owner === undefined ? owner : p.owner;
      if (o) q.set("owner", o);
      router.push(`${pathname}?${q.toString()}`);
    });
  const diff = summary.differenceFils;
  const blank: Dep = {
    id: "",
    date: todayKuwait(),
    amountFils: 0,
    destination: "office_bank",
    ownerId: null,
    owner: "",
    bankName: "",
    reference: "",
    notes: "",
    properties: [],
  };
  const allocated = edit ? edit.properties.reduce((a, p) => a + p.amountFils, 0) : 0;

  const cols: ColumnDef<SummaryPropertyRow, unknown>[] = [
    { accessorKey: "propertyName", header: tc("labels.property") },
    {
      accessorKey: "expectedFils",
      header: t("summary.expected"),
      meta: {
        numeric: true,
        footer: money(
          summary.rows.reduce((a, r) => a + r.expectedFils, 0),
          { showCurrency: false },
        ),
      },
      cell: (c) => money(c.row.original.expectedFils, { showCurrency: false }),
    },
    {
      accessorKey: "collectedFils",
      header: t("summary.collected"),
      meta: { numeric: true, footer: money(summary.collectedFils, { showCurrency: false }) },
      cell: (c) => money(c.row.original.collectedFils, { showCurrency: false }),
    },
    {
      accessorKey: "arrearsFils",
      header: t("summary.arrears"),
      meta: { numeric: true },
      cell: (c) => (
        <span className={cn(c.row.original.arrearsFils > 0 && "text-red-text")}>
          {money(c.row.original.arrearsFils, { showCurrency: false })}
        </span>
      ),
    },
    {
      accessorKey: "expensesFils",
      header: t("summary.expenses"),
      meta: {
        numeric: true,
        footer: money(
          summary.rows.reduce((a, r) => a + r.expensesFils, 0),
          { showCurrency: false },
        ),
      },
      cell: (c) => money(c.row.original.expensesFils, { showCurrency: false }),
    },
    {
      accessorKey: "netFils",
      header: t("summary.net"),
      meta: { numeric: true },
      cell: (c) => money(c.row.original.netFils, { showCurrency: false }),
    },
    {
      accessorKey: "depositsFils",
      header: t("summary.deposits"),
      meta: {
        numeric: true,
        footer: money(
          summary.rows.reduce((a, r) => a + r.depositsFils, 0),
          { showCurrency: false },
        ),
      },
      cell: (c) => money(c.row.original.depositsFils, { showCurrency: false }),
    },
  ];
  const depCols: ColumnDef<Dep, unknown>[] = [
    {
      accessorKey: "date",
      header: t("columns.date"),
      cell: (c) => <span className="num">{formatDate(c.row.original.date)}</span>,
    },
    {
      accessorKey: "destination",
      header: t("columns.destination"),
      cell: (c) => tDest(c.row.original.destination),
    },
    { accessorKey: "owner", header: t("columns.owner") },
    { accessorKey: "bankName", header: t("columns.bank") },
    {
      accessorKey: "reference",
      header: t("columns.reference"),
      cell: (c) => <span className="num">{c.row.original.reference}</span>,
    },
    {
      id: "props",
      header: t("columns.properties"),
      enableSorting: false,
      cell: (c) => (
        <span className="text-label-2 text-[13px]">
          {c.row.original.properties.map((p) => p.name).join("، ")}
        </span>
      ),
    },
    {
      accessorKey: "amountFils",
      header: t("columns.amount"),
      meta: { numeric: true },
      cell: (c) => <span className="font-semibold">{money(c.row.original.amountFils)}</span>,
    },
  ];

  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        actions={
          canManage ? (
            <Button onClick={() => setEdit(blank)}>
              <Plus />
              {t("new")}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            fill={false}
            options={[
              { value: "summary", label: t("tabs.summary") },
              { value: "list", label: t("tabs.list") },
            ]}
            value={tab}
            onChange={(v) => setTab(v as "summary" | "list")}
          />
          {tab === "summary" && <MonthPicker value={period} onChange={(p) => go({ period: p })} />}
        </div>
        {tab === "summary" && owners.length > 1 && (
          <ChipScroller className="mt-3">
            <Chip active={!owner} onClick={() => go({ owner: null })}>
              {t("summary.allOwners")}
            </Chip>
            {owners.map((o) => (
              <Chip key={o.id} active={owner === o.id} onClick={() => go({ owner: o.id })}>
                {o.name}
              </Chip>
            ))}
          </ChipScroller>
        )}
      </LargeTitleHeader>

      {tab === "summary" ? (
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[20px] leading-7 font-semibold">
                {t("summary.heading", { month: formatPeriod(period, locale) })}
              </h2>
              <Button asChild variant="secondary" size="icon-sm" aria-label={t("summary.print")}>
                <a
                  href={`/print/summary/${period}?lang=${locale}${owner ? `&owner=${owner}` : ""}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer />
                </a>
              </Button>
            </div>
            <dl className="divide-separator divide-y-[0.5px] text-[16px]">
              {[
                [t("summary.collected"), summary.collectedFils],
                [t("summary.deposits"), summary.depositsFils],
                [t("summary.expenses"), summary.expensesFils],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between py-3">
                  <dt>{l}</dt>
                  <dd className="num text-[20px] font-semibold">{money(v as number)}</dd>
                </div>
              ))}
              <div
                className={cn(
                  "-mx-3 flex items-center justify-between rounded-[14px] px-3 py-3",
                  diff !== 0 ? "bg-orange/14" : "bg-green/12",
                )}
              >
                <dt className="flex items-center gap-2">
                  {diff !== 0 ? (
                    <AlertTriangle className="text-orange-text size-5" />
                  ) : (
                    <CheckCircle2 className="text-green-text size-5" />
                  )}
                  {t("summary.difference")}
                </dt>
                <dd
                  className={cn(
                    "num text-[20px] font-semibold",
                    diff !== 0 ? "text-orange-text" : "text-green-text",
                  )}
                >
                  {money(diff)}
                </dd>
              </div>
            </dl>
            {diff === 0 ? (
              <p className="text-green-text text-[14px]">{t("summary.reconciled")}</p>
            ) : (
              <div className="space-y-2">
                <Field label={t("summary.explain")} htmlFor="rec-note">
                  <Textarea
                    id="rec-note"
                    rows={2}
                    placeholder={t("summary.explainPlaceholder")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={!canManage}
                  />
                </Field>
                {canManage && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pending}
                    onClick={() =>
                      exec(() => saveReconciliationNote(period, note, owner), {
                        success: t("summary.noteSaved"),
                      })
                    }
                  >
                    {t("summary.saveNote")}
                  </Button>
                )}
              </div>
            )}
          </Card>
          <section className="min-w-0">
            <h3 className="mb-3 text-[20px] font-semibold">{t("summary.perProperty")}</h3>
            <DataTable
              data={summary.rows}
              columns={cols}
              showFooter
              density="compact"
              maxHeight="none"
              getRowId={(r) => r.propertyId}
            />
          </section>
        </div>
      ) : deposits.length === 0 ? (
        <EmptyState
          illustration={<NoPaymentsIllustration />}
          title={t("empty")}
          description={t("emptyText")}
          action={
            canManage ? (
              <Button onClick={() => setEdit(blank)}>
                <Plus />
                {t("new")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          data={deposits}
          columns={depCols}
          getRowId={(r) => r.id}
          onRowClick={canManage ? (r) => setEdit(r) : undefined}
        />
      )}

      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? t("edit") : t("new")}
        footer={
          <div className="flex gap-2">
            {edit?.id && (
              <Button variant="tinted" size="lg" onClick={() => setDel(edit.id)}>
                {t("form.delete")}
              </Button>
            )}
            <Button
              block
              size="lg"
              loading={pending}
              disabled={
                !edit?.amountFils || (edit.properties.length > 0 && allocated !== edit.amountFils)
              }
              onClick={() =>
                edit &&
                exec(
                  () =>
                    saveDeposit(edit.id || null, {
                      date: edit.date,
                      amountFils: edit.amountFils,
                      destination: edit.destination,
                      ownerId: edit.ownerId,
                      bankName: edit.bankName,
                      reference: edit.reference,
                      notes: edit.notes,
                      properties: edit.properties.filter((p) => p.amountFils > 0),
                    }),
                  {
                    success: t("form.saved"),
                    onSuccess: () => {
                      setEdit(null);
                      router.refresh();
                    },
                  },
                )
              }
            >
              {tc("actions.save")}
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Field label={t("form.date")} htmlFor="d-date">
              <DatePicker
                id="d-date"
                value={edit.date}
                onChange={(d) => d && setEdit({ ...edit, date: d })}
              />
            </Field>
            <Field label={t("form.amount")} htmlFor="d-amt">
              <MoneyInput
                id="d-amt"
                size="lg"
                value={edit.amountFils || null}
                onChange={(f) => setEdit({ ...edit, amountFils: f ?? 0 })}
              />
            </Field>
            <Field label={t("form.destination")}>
              <SegmentedControl
                size="sm"
                options={(["office_bank", "owner_bank", "cash_to_owner"] as const).map((k) => ({
                  value: k,
                  label: tDest(k),
                }))}
                value={edit.destination}
                onChange={(k) => setEdit({ ...edit, destination: k })}
              />
            </Field>
            <Field label={t("form.owner")} htmlFor="d-owner">
              <Select
                id="d-owner"
                value={edit.ownerId ?? ""}
                onChange={(e) => setEdit({ ...edit, ownerId: e.target.value || null })}
              >
                <option value="">{t("form.noOwner")}</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("form.bank")} htmlFor="d-bank">
                <Input
                  id="d-bank"
                  value={edit.bankName}
                  onChange={(e) => setEdit({ ...edit, bankName: e.target.value })}
                />
              </Field>
              <Field label={t("form.reference")} htmlFor="d-ref">
                <Input
                  id="d-ref"
                  dir="ltr"
                  value={edit.reference}
                  onChange={(e) => setEdit({ ...edit, reference: e.target.value })}
                />
              </Field>
            </div>
            <Field
              label={t("form.split")}
              hint={
                edit.properties.length
                  ? t("form.remaining", { amount: money(edit.amountFils - allocated) })
                  : undefined
              }
            >
              <div className="space-y-2">
                {properties.map((p) => {
                  const cur = edit.properties.find((x) => x.propertyId === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="flex-1 text-[15px]">{p.name}</span>
                      <div className="w-44">
                        <MoneyInput
                          showWords={false}
                          value={cur?.amountFils ?? null}
                          onChange={(f) => {
                            const rest = edit.properties.filter((x) => x.propertyId !== p.id);
                            setEdit({
                              ...edit,
                              properties: f
                                ? [...rest, { propertyId: p.id, amountFils: f, name: p.name }]
                                : rest,
                            });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
            <Field label={t("form.notes")} htmlFor="d-notes">
              <Textarea
                id="d-notes"
                rows={2}
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Sheet>
      <AlertDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={t("form.deleteConfirm")}
        confirmLabel={tc("actions.delete")}
        cancelLabel={tc("actions.cancel")}
        destructive
        loading={pending}
        onConfirm={() =>
          del &&
          exec(() => deleteDeposit(del), {
            success: t("form.deleted"),
            onSuccess: () => {
              setDel(null);
              setEdit(null);
              router.refresh();
            },
          })
        }
      />
    </>
  );
}
