"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  BadgePercent,
  BellRing,
  CalendarClock,
  Copy,
  FileCheck2,
  FileText,
  Flag,
  PlusCircle,
  Printer,
  RefreshCw,
  TrendingUp,
  Upload,
  XOctagon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractStatusPill, PeriodStatusPill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Sheet } from "@/components/ui/sheet";
import { AlertDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import {
  duplicateContract,
  endContract,
  quoteTermination,
  recordNotice,
  renewContract,
  reviseRent,
  terminateContract,
  uploadSignedContract,
  type TerminationQuote,
} from "@/server/actions/contracts";
import { addDays, addMonths, formatDate, formatPeriod } from "@/domain/dates";
import { allowedActions, expectedMoveOut } from "@/domain/contracts";
import { tafqeetDuration, durationEN } from "@/domain/tafqeet";
import { cn } from "@/lib/utils";
import type { ChargeKind, ContractStatus, ContractType, PeriodStatus } from "@/domain/types";

// Sheets are code-split: they load after hydration instead of with the page.
const AdjustmentSheet = dynamic(
  () => import("@/components/domain/payments/adjustment-sheet").then((m) => m.AdjustmentSheet),
  { ssr: false },
);
const ManualChargeSheet = dynamic(
  () => import("@/components/domain/payments/adjustment-sheet").then((m) => m.ManualChargeSheet),
  { ssr: false },
);

interface ScheduleRow {
  period: string;
  dueDate: string;
  kinds: ChargeKind[];
  amountFils: number;
  waivedFils: number;
  paidFils: number;
  status: PeriodStatus;
}

export interface ContractDetail {
  id: string;
  contractNo: string;
  type: ContractType;
  status: ContractStatus;
  tenantId: string;
  tenantName: string;
  tenantPhone: string | null;
  propertyId: string;
  propertyName: string;
  units: { id: string; label: string }[];
  contractDate: string;
  startDate: string;
  firstCollectionDate: string;
  endDate: string;
  termMonths: number;
  autoRenew: boolean;
  renewalTermMonths: number | null;
  monthlyRentFils: number;
  freeMonths: number;
  noticePeriodMonths: number;
  securityDepositFils: number;
  depositStatus: string;
  noticeDate: string | null;
  expectedMoveOut: string | null;
  moveOutDate: string | null;
  terminationReason: string | null;
  createdAt: string;
  activatedAt: string | null;
  signedUrl: string | null;
  revisions: {
    effectiveFrom: string;
    monthlyRentFils: number;
    reason: string | null;
    createdAt: string;
  }[];
  renewedTo: { id: string; contract_no: string } | null;
  renewedFrom: { id: string; contract_no: string } | null;
  suggestedPenaltyToday: number;
}

type SheetKind = "notice" | "revise" | "renew" | "terminate" | null;

export function ContractDetailView({
  today,
  contract: c,
  schedule,
  balance,
  payments,
  canManage,
  paymentAction,
}: {
  today: string;
  contract: ContractDetail;
  schedule: ScheduleRow[];
  balance: { arrearsFils: number; creditFils: number; paidFils: number; chargedFils: number };
  payments: { date: string; amountFils: number; receiptNo: string | null }[];
  canManage: boolean;
  canPay: boolean;
  paymentAction?: React.ReactNode;
}) {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");
  const tEnum = useTranslations("enums");
  const tp = useTranslations("payments");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [manual, setManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const actions = canManage ? allowedActions(c.status) : [];

  // sheet state
  const [noticeDate, setNoticeDate] = useState(today);
  const [moveOutExp, setMoveOutExp] = useState(expectedMoveOut(today, c.noticePeriodMonths));
  const [revFrom, setRevFrom] = useState(addMonths(today.slice(0, 8) + "01", 1));
  const [revAmount, setRevAmount] = useState<number | null>(c.monthlyRentFils);
  const [revReason, setRevReason] = useState("");
  const [renTerm, setRenTerm] = useState(c.renewalTermMonths ?? c.termMonths);
  const [renRent, setRenRent] = useState<number | null>(c.monthlyRentFils);
  const [moveOut, setMoveOut] = useState(c.expectedMoveOut ?? today);
  const [reason, setReason] = useState("");
  const [penalty, setPenalty] = useState<number | null>(null);
  const [quote, setQuote] = useState<TerminationQuote | null>(null);

  useEffect(() => {
    if (sheet !== "terminate") return;
    let cancelled = false;
    setQuote(null);
    void quoteTermination(c.id, moveOut, penalty ?? undefined).then((r) => {
      if (!cancelled && r.ok) {
        setQuote(r.data);
        setPenalty((p) => (p === null ? r.data.penaltyFils : p));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sheet, moveOut, penalty, c.id]);

  const dur = (m: number) => (locale === "ar" ? tafqeetDuration(m) : durationEN(m));

  const columns: ColumnDef<ScheduleRow, unknown>[] = [
    {
      accessorKey: "period",
      header: t("detail.period"),
      cell: (x) => formatPeriod(x.row.original.period, locale),
    },
    {
      accessorKey: "dueDate",
      header: tc("labels.date"),
      cell: (x) => <span className="num">{formatDate(x.row.original.dueDate)}</span>,
    },
    {
      id: "kinds",
      header: tc("labels.type"),
      enableSorting: false,
      cell: (x) => (
        <span className="text-label-2 text-[14px]">
          {x.row.original.kinds.map((k) => tEnum(`chargeKind.${k}`)).join(" + ")}
        </span>
      ),
    },
    {
      accessorKey: "amountFils",
      header: tc("labels.amount"),
      meta: { numeric: true },
      cell: (x) =>
        x.row.original.kinds.includes("free") ? (
          <span className="text-teal-text">{money(x.row.original.waivedFils)}</span>
        ) : (
          money(x.row.original.amountFils)
        ),
    },
    {
      accessorKey: "paidFils",
      header: t("detail.paid"),
      meta: { numeric: true },
      cell: (x) => money(x.row.original.paidFils),
    },
    {
      accessorKey: "status",
      header: tc("labels.status"),
      cell: (x) => <PeriodStatusPill status={x.row.original.status} />,
    },
  ];

  const events: { date: string; label: string; tone: string }[] = [
    { date: c.createdAt.slice(0, 10), label: t("detail.events.created"), tone: "bg-gray" },
    ...(c.activatedAt
      ? [
          {
            date: c.activatedAt.slice(0, 10),
            label: t("detail.events.activated"),
            tone: "bg-green",
          },
        ]
      : []),
    ...(c.noticeDate
      ? [{ date: c.noticeDate, label: t("detail.events.notice"), tone: "bg-orange" }]
      : []),
    ...c.revisions.map((r) => ({
      date: r.effectiveFrom,
      label: t("detail.events.revision", { amount: money(r.monthlyRentFils) }),
      tone: "bg-indigo",
    })),
    ...payments.map((p) => ({
      date: p.date,
      label:
        t("detail.events.payment", { amount: money(p.amountFils) }) +
        (p.receiptNo ? ` · #${p.receiptNo}` : ""),
      tone: "bg-green",
    })),
    ...(c.renewedTo
      ? [{ date: addDays(c.endDate, 1), label: t("detail.events.renewed"), tone: "bg-indigo" }]
      : []),
    ...(c.status === "terminated" && c.moveOutDate
      ? [{ date: c.moveOutDate, label: t("detail.events.terminated"), tone: "bg-red" }]
      : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <LargeTitleHeader
        title={<span className="num">{c.contractNo}</span>}
        subtitle={`${c.tenantName} · ${c.propertyName} · ${c.units.map((u) => u.label).join(", ")}`}
        back={{ href: "/contracts", label: t("title") }}
        actions={
          <Button asChild variant="secondary" size="icon" aria-label={t("actions.print")}>
            <a href={`/print/contract/${c.id}?lang=ar`} target="_blank" rel="noreferrer">
              <Printer />
            </a>
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <ContractStatusPill status={c.status} />
          <span className="bg-inset text-label-2 rounded-full px-2.5 py-0.5 text-[12px] font-semibold">
            {tEnum(`contractType.${c.type}`)}
          </span>
        </div>
      </LargeTitleHeader>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [t("detail.rent"), money(c.monthlyRentFils), ""],
              [
                t("detail.arrears"),
                money(balance.arrearsFils),
                balance.arrearsFils > 0 ? "text-red-text" : "",
              ],
              [
                t("detail.credit"),
                money(balance.creditFils),
                balance.creditFils > 0 ? "text-indigo-text" : "",
              ],
              [t("detail.paid"), money(balance.paidFils), ""],
            ].map(([label, value, cls]) => (
              <Card key={label} className="p-4">
                <div className="text-label-2 text-[13px]">{label}</div>
                <div className={cn("num mt-1 text-[20px] font-semibold", cls)}>{value}</div>
              </Card>
            ))}
          </div>
          {paymentAction && <div className="flex justify-end">{paymentAction}</div>}
          <section>
            <h2 className="mb-3 text-[20px] font-semibold">{t("detail.schedule")}</h2>
            <DataTable
              data={schedule}
              columns={columns}
              maxHeight="60vh"
              initialSorting={[{ id: "period", desc: false }]}
              rowClassName={(r) =>
                r.period.slice(0, 7) === today.slice(0, 7)
                  ? "bg-[color-mix(in_srgb,var(--brand-gulf)_5%,transparent)]"
                  : undefined
              }
            />
          </section>
        </div>

        <div className="space-y-5">
          <GroupedSection>
            <ListRow
              LinkComponent={Link}
              href={`/tenants/${c.tenantId}`}
              title={tc("labels.tenant")}
              trailing={c.tenantName}
              chevron
            />
            <ListRow
              LinkComponent={Link}
              href={`/properties/${c.propertyId}`}
              title={tc("labels.property")}
              trailing={c.propertyName}
              chevron
            />
            {c.units.map((u) => (
              <ListRow
                key={u.id}
                LinkComponent={Link}
                href={`/units/${u.id}`}
                title={tc("labels.unit")}
                trailing={u.label}
                chevron
              />
            ))}
            <ListRow
              title={t("detail.term")}
              trailing={<span>{dur(c.termMonths)}</span>}
              subtitle={
                <span className="num">
                  {formatDate(c.startDate)} – {formatDate(c.moveOutDate ?? c.endDate)}
                </span>
              }
            />
            {c.firstCollectionDate !== c.startDate && (
              <ListRow
                title={t("detail.grace")}
                trailing={<span className="num">{formatDate(c.firstCollectionDate)}</span>}
              />
            )}
            {c.securityDepositFils > 0 && (
              <ListRow
                title={t("detail.deposit")}
                trailing={<span className="num">{money(c.securityDepositFils)}</span>}
                subtitle={tEnum(`depositStatus.${c.depositStatus}` as "depositStatus.held")}
              />
            )}
            {c.noticeDate && (
              <ListRow
                title={t("detail.noticeDate")}
                trailing={<span className="num">{formatDate(c.noticeDate)}</span>}
                subtitle={
                  c.expectedMoveOut
                    ? `${t("detail.expectedMoveOut")}: ${formatDate(c.expectedMoveOut)}`
                    : undefined
                }
              />
            )}
            {c.moveOutDate && (
              <ListRow
                title={t("detail.moveOut")}
                trailing={<span className="num">{formatDate(c.moveOutDate)}</span>}
                subtitle={c.terminationReason ?? undefined}
              />
            )}
            {c.renewedFrom && (
              <ListRow
                LinkComponent={Link}
                href={`/contracts/${c.renewedFrom.id}`}
                title={t("detail.renewedFrom")}
                trailing={<span className="num">{c.renewedFrom.contract_no}</span>}
                chevron
              />
            )}
            {c.renewedTo && (
              <ListRow
                LinkComponent={Link}
                href={`/contracts/${c.renewedTo.id}`}
                title={t("detail.renewedTo")}
                trailing={<span className="num">{c.renewedTo.contract_no}</span>}
                chevron
              />
            )}
          </GroupedSection>

          <GroupedSection header={t("detail.signed")}>
            {c.signedUrl ? (
              <ListRow
                leading={
                  <IconTile tone="green">
                    <FileCheck2 />
                  </IconTile>
                }
                title={t("detail.signed")}
                href={c.signedUrl}
                LinkComponent={(p: React.ComponentProps<"a">) => (
                  <a {...p} target="_blank" rel="noreferrer" />
                )}
                chevron
              />
            ) : (
              <ListRow
                leading={
                  <IconTile tone="soft">
                    <FileText />
                  </IconTile>
                }
                title={t("detail.notSigned")}
              />
            )}
            {canManage && (
              <ListRow
                leading={
                  <IconTile tone="gulf">
                    <Upload />
                  </IconTile>
                }
                title={t("actions.upload")}
                onClick={() => fileRef.current?.click()}
              />
            )}
          </GroupedSection>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*,application/pdf"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.set("file", f);
              await exec(() => uploadSignedContract(c.id, fd), {
                success: t("uploaded"),
                onSuccess: () => router.refresh(),
              });
            }}
          />

          {actions.length > 0 && (
            <GroupedSection header={tc("labels.actions")}>
              {actions.includes("record_notice") && (
                <ListRow
                  leading={
                    <IconTile tone="orange">
                      <BellRing />
                    </IconTile>
                  }
                  title={t("actions.notice")}
                  onClick={() => setSheet("notice")}
                  chevron
                />
              )}
              {actions.includes("revise_rent") && (
                <ListRow
                  leading={
                    <IconTile tone="indigo">
                      <TrendingUp />
                    </IconTile>
                  }
                  title={t("actions.revise")}
                  onClick={() => setSheet("revise")}
                  chevron
                />
              )}
              {actions.includes("renew") && (
                <ListRow
                  leading={
                    <IconTile tone="teal">
                      <RefreshCw />
                    </IconTile>
                  }
                  title={t("actions.renew")}
                  onClick={() => setSheet("renew")}
                  chevron
                />
              )}
              {actions.includes("end") && c.endDate <= today && (
                <ListRow
                  leading={
                    <IconTile tone="gray">
                      <Flag />
                    </IconTile>
                  }
                  title={t("actions.end")}
                  onClick={() => setConfirmEnd(true)}
                  chevron
                />
              )}
              <ListRow
                leading={
                  <IconTile tone="green">
                    <BadgePercent />
                  </IconTile>
                }
                title={tp("adjust.title")}
                onClick={() => setAdjust(true)}
                chevron
              />
              <ListRow
                leading={
                  <IconTile tone="orange">
                    <PlusCircle />
                  </IconTile>
                }
                title={tEnum("chargeKind.maintenance_recharge")}
                onClick={() => setManual(true)}
                chevron
              />
              <ListRow
                leading={
                  <IconTile tone="soft">
                    <Copy />
                  </IconTile>
                }
                title={t("actions.duplicate")}
                onClick={() =>
                  exec(() => duplicateContract(c.id), {
                    success: t("duplicated"),
                    onSuccess: (id) => router.push(`/contracts/new?draft=${id}`),
                  })
                }
              />
              {actions.includes("terminate") && (
                <ListRow
                  leading={
                    <IconTile tone="red">
                      <XOctagon />
                    </IconTile>
                  }
                  title={t("actions.terminate")}
                  destructive
                  onClick={() => setSheet("terminate")}
                />
              )}
            </GroupedSection>
          )}

          <section>
            <h3 className="text-label-2 px-5 pb-2 text-[13px] font-medium">
              {t("detail.timeline")}
            </h3>
            <Card className="p-5">
              <ol className="border-separator relative space-y-4 border-s-2 ps-5">
                {events.map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      className={cn(
                        "absolute -start-[27px] top-1.5 size-3 rounded-full ring-4 ring-[var(--bg-elevated)]",
                        e.tone,
                      )}
                    />
                    <div className="text-[15px]">{e.label}</div>
                    <div className="text-label-2 num text-[12px]">{formatDate(e.date)}</div>
                  </li>
                ))}
              </ol>
            </Card>
          </section>
        </div>
      </div>

      <Sheet
        open={sheet === "notice"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={t("notice.title")}
        footer={
          <Button
            block
            size="lg"
            loading={pending}
            onClick={() =>
              exec(() => recordNotice(c.id, { noticeDate, expectedMoveOut: moveOutExp }), {
                success: t("notice.saved"),
                onSuccess: () => {
                  setSheet(null);
                  router.refresh();
                },
              })
            }
          >
            {tc("actions.save")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("notice.date")} htmlFor="n-date">
            <DatePicker
              id="n-date"
              value={noticeDate}
              onChange={(d) => {
                if (d) {
                  setNoticeDate(d);
                  setMoveOutExp(expectedMoveOut(d, c.noticePeriodMonths));
                }
              }}
            />
          </Field>
          <Field label={t("notice.moveOut")} htmlFor="n-out">
            <DatePicker id="n-out" value={moveOutExp} onChange={(d) => d && setMoveOutExp(d)} />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={sheet === "revise"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={t("revise.title")}
        footer={
          <Button
            block
            size="lg"
            loading={pending}
            disabled={!revAmount}
            onClick={() =>
              exec(
                () =>
                  reviseRent(c.id, {
                    effectiveFrom: revFrom,
                    monthlyRentFils: revAmount ?? 0,
                    reason: revReason,
                  }),
                {
                  success: t("revise.saved"),
                  onSuccess: () => {
                    setSheet(null);
                    router.refresh();
                  },
                },
              )
            }
          >
            {tc("actions.save")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("revise.from")} htmlFor="r-from">
            <DatePicker id="r-from" value={revFrom} onChange={(d) => d && setRevFrom(d)} />
          </Field>
          <Field label={t("revise.amount")} htmlFor="r-amt">
            <MoneyInput id="r-amt" value={revAmount} onChange={setRevAmount} size="lg" />
          </Field>
          <Field label={t("revise.reason")} htmlFor="r-reason">
            <Input id="r-reason" value={revReason} onChange={(e) => setRevReason(e.target.value)} />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={sheet === "renew"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={t("renew.title")}
        footer={
          <Button
            block
            size="lg"
            loading={pending}
            disabled={!renRent}
            onClick={() =>
              exec(
                () =>
                  renewContract(c.id, {
                    termMonths: renTerm,
                    monthlyRentFils: renRent ?? 0,
                    activate: true,
                  }),
                {
                  success: t("renew.saved"),
                  onSuccess: (id) => {
                    setSheet(null);
                    router.push(`/contracts/${id}`);
                  },
                },
              )
            }
          >
            {t("actions.renew")}
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-label-2 text-[14px]">
            {t("renew.starts", { date: formatDate(addDays(c.endDate, 1)) })}
          </p>
          <Field label={t("renew.term")} htmlFor="rn-term">
            <Input
              id="rn-term"
              inputMode="numeric"
              className="num"
              value={renTerm}
              onChange={(e) =>
                setRenTerm(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))
              }
            />
          </Field>
          <p className="text-label-2 px-1 text-[13px]">{dur(renTerm)}</p>
          <Field label={t("renew.rent")} htmlFor="rn-rent">
            <MoneyInput id="rn-rent" value={renRent} onChange={setRenRent} size="lg" />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={sheet === "terminate"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={t("terminate.title")}
        footer={
          <Button
            block
            size="lg"
            variant="destructive"
            loading={pending}
            disabled={!reason.trim() || !quote}
            onClick={() =>
              exec(
                () =>
                  terminateContract(c.id, {
                    moveOutDate: moveOut,
                    reason,
                    penaltyFils: penalty ?? 0,
                  }),
                {
                  success: t("terminate.done"),
                  onSuccess: () => {
                    setSheet(null);
                    router.refresh();
                  },
                },
              )
            }
          >
            {t("terminate.confirm")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("terminate.moveOut")} htmlFor="t-out">
            <DatePicker
              id="t-out"
              value={moveOut}
              min={c.startDate}
              onChange={(d) => {
                if (d) {
                  setMoveOut(d);
                  setPenalty(null);
                }
              }}
            />
          </Field>
          <Field label={t("terminate.reason")} htmlFor="t-reason">
            <Textarea id="t-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {c.freeMonths > 0 && (
            <Field label={t("terminate.penalty")} hint={t("terminate.penaltyHint")} htmlFor="t-pen">
              <MoneyInput id="t-pen" value={penalty} onChange={(v) => setPenalty(v ?? 0)} />
            </Field>
          )}
          {quote ? (
            <GroupedSection>
              <ListRow
                title={t("terminate.arrears")}
                trailing={<span className="num">{money(quote.arrearsFils)}</span>}
              />
              {quote.penaltyFils > 0 && (
                <ListRow
                  title={t("terminate.penalty")}
                  trailing={<span className="num">{money(quote.penaltyFils)}</span>}
                />
              )}
              {quote.depositFils > 0 && (
                <ListRow
                  title={t("terminate.deposit")}
                  trailing={<span className="num">{money(quote.depositFils)}</span>}
                />
              )}
              {quote.depositFils > 0 && (
                <ListRow
                  title={t("terminate.applied")}
                  trailing={<span className="num">{money(quote.depositAppliedFils)}</span>}
                />
              )}
              {quote.depositFils > 0 && (
                <ListRow
                  title={t("terminate.refund")}
                  trailing={<span className="num text-green-text">{money(quote.refundFils)}</span>}
                />
              )}
              <ListRow
                title={t("terminate.remaining")}
                trailing={
                  <span
                    className={cn(
                      "num font-semibold",
                      quote.remainingDueFils > 0 && "text-red-text",
                    )}
                  >
                    {money(quote.remainingDueFils)}
                  </span>
                }
              />
            </GroupedSection>
          ) : (
            <Skeleton className="h-40" />
          )}
          <p className="text-label-2 flex items-center gap-2 text-[13px]">
            <CalendarClock className="size-4" />
            {t("terminate.futureVoided")}
          </p>
        </div>
      </Sheet>

      <AdjustmentSheet open={adjust} onOpenChange={setAdjust} contractId={c.id} />
      <ManualChargeSheet open={manual} onOpenChange={setManual} contractId={c.id} />
      <AlertDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title={t("end.confirm")}
        description={t("end.text")}
        confirmLabel={t("actions.end")}
        cancelLabel={tc("actions.cancel")}
        loading={pending}
        onConfirm={() =>
          exec(() => endContract(c.id), {
            success: t("end.done"),
            onSuccess: () => {
              setConfirmEnd(false);
              router.refresh();
            },
          })
        }
      />
    </>
  );
}
