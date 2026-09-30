"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney, useSession } from "@/components/shell/prefs-context";
import {
  checkReceiptNo,
  getPaymentContext,
  recordPayment,
  type PaymentContext,
} from "@/server/actions/payments";
import { uploadAttachment } from "@/server/actions/files";
import { allocateFIFO, allocateToPeriods } from "@/domain/allocation";
import { formatDate, formatPeriod, todayKuwait } from "@/domain/dates";
import { whatsappLink } from "@/domain/validation";
import { fromFils } from "@/domain/money";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/types";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { queueOfflinePayment, isOffline } from "@/lib/offline/outbox-client";
import { ASK_PUSH_EVENT } from "@/components/pwa/push-prompt";

type AmountMode = "month" | "due" | "custom";

/** Record-payment sheet for one contract (§10.6). Works offline via the outbox. */
export function PaymentSheet({
  open,
  onOpenChange,
  contractId,
  offlineContext,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contractId: string | null;
  /** Prefilled context when offline (from IndexedDB). */
  offlineContext?: PaymentContext | null;
  onSaved?: () => void;
}) {
  const t = useTranslations("payments.sheet");
  const tMethod = useTranslations("enums.paymentMethod");
  const tKind = useTranslations("enums.chargeKind");
  const tc = useTranslations("common.actions");
  const tErr = useTranslations("errors");
  const tOutbox = useTranslations("pwa.outbox");
  const tPill = useTranslations("pwa.pill");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const session = useSession();
  const router = useRouter();
  const [ctx, setCtx] = useState<PaymentContext | null>(null);
  const [mode, setMode] = useState<AmountMode>("due");
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(todayKuwait());
  const [receipt, setReceipt] = useState("");
  const [dup, setDup] = useState<Awaited<ReturnType<typeof checkReceiptNo>>>(null);
  const [reference, setReference] = useState("");
  const [collector, setCollector] = useState(session.userId);
  const [notes, setNotes] = useState("");
  const [allocMode, setAllocMode] = useState<"fifo" | "periods">("fifo");
  const [periods, setPeriods] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !contractId) return;
    setCtx(null);
    setUnavailable(false);
    setReceipt("");
    setDup(null);
    setReference("");
    setNotes("");
    setPhoto(null);
    setAllocMode("fifo");
    setDate(todayKuwait());
    setCollector(session.userId);
    if (isOffline() && offlineContext) {
      setCtx(offlineContext);
      return;
    }
    getPaymentContext(contractId)
      .then((r) => {
        if (r.ok) setCtx(r.data);
        else if (offlineContext) setCtx(offlineContext);
        else setUnavailable(true);
      })
      .catch(() => (offlineContext ? setCtx(offlineContext) : setUnavailable(true)));
  }, [open, contractId, offlineContext, session.userId]);

  useEffect(() => {
    if (!ctx) return;
    const due = ctx.dueNowFils;
    const initial = due > 0 ? due : ctx.monthlyRentFils;
    setMode(due > 0 ? "due" : "custom");
    setAmount(initial);
    setPeriods([...new Set(ctx.open.map((o) => o.period))].slice(0, 1));
  }, [ctx]);

  const pickMode = (m: AmountMode) => {
    setMode(m);
    if (!ctx) return;
    if (m === "month") setAmount(ctx.thisMonthFils || ctx.monthlyRentFils);
    if (m === "due") setAmount(ctx.dueNowFils);
  };

  const preview = useMemo(() => {
    if (!ctx || !amount) return null;
    return allocMode === "fifo"
      ? allocateFIFO(amount, ctx.open)
      : allocateToPeriods(amount, ctx.open, periods);
  }, [ctx, amount, allocMode, periods]);

  const coveredPeriods = useMemo(() => {
    if (!ctx || !preview) return [];
    const byPeriod = new Map<string, { paid: number; outstanding: number }>();
    for (const o of ctx.open) {
      const cur = byPeriod.get(o.period) ?? { paid: 0, outstanding: 0 };
      cur.outstanding += o.outstandingFils;
      byPeriod.set(o.period, cur);
    }
    for (const a of preview.allocations) {
      const ch = ctx.open.find((o) => o.id === a.chargeId)!;
      byPeriod.get(ch.period)!.paid += a.amountFils;
    }
    return [...byPeriod.entries()]
      .filter(([, v]) => v.paid > 0)
      .map(([p, v]) => ({ period: p, paid: v.paid, full: v.paid >= v.outstanding }));
  }, [ctx, preview]);

  const onReceiptBlur = async () => {
    if (!receipt.trim() || isOffline()) return setDup(null);
    setDup(await checkReceiptNo(receipt.trim()));
  };

  const save = async () => {
    if (!ctx || !amount) return;
    setSaving(true);
    const input = {
      contractId: ctx.contractId,
      amountFils: amount,
      method,
      receivedAt: date,
      receiptNo: receipt.trim() || null,
      reference: reference.trim() || null,
      collectedBy: collector,
      notes: notes.trim() || null,
      clientId: crypto.randomUUID(),
      allocation:
        allocMode === "fifo"
          ? ({ mode: "fifo" } as const)
          : ({ mode: "periods", periods } as const),
    };
    const queue = async () => {
      await queueOfflinePayment(input, {
        tenantName: ctx.tenantName,
        unitLabels: ctx.unitLabels,
        propertyName: ctx.propertyName,
      });
      setSaving(false);
      onOpenChange(false);
      onSaved?.();
      toast.success(t("saved", { amount: money(amount) }), {
        description: tOutbox("savedOffline"),
      });
    };
    if (isOffline()) return queue();
    let r: Awaited<ReturnType<typeof recordPayment>>;
    try {
      r = await recordPayment(input);
    } catch {
      // Connection dropped mid-save: the client_id keeps the later sync idempotent.
      return queue();
    }
    setSaving(false);
    if (!r.ok) {
      const key = r.error as Parameters<typeof tErr>[0];
      toast.error(
        r.error === "duplicate_receipt"
          ? t("duplicate", { no: receipt, tenant: dup?.tenant ?? "", date: formatDate(dup?.date) })
          : tErr.has(key)
            ? tErr(key)
            : tErr("generic"),
      );
      return;
    }
    window.dispatchEvent(new CustomEvent(ASK_PUSH_EVENT));
    if (photo) {
      const fd = new FormData();
      fd.set("file", photo);
      await uploadAttachment("payment", r.data.id, fd, "receipts");
    }
    onOpenChange(false);
    onSaved?.();
    router.refresh();
    const periodsText = coveredPeriods
      .map((c) => formatPeriod(c.period, locale))
      .join(locale === "ar" ? "، " : ", ");
    const confirm = t("confirmText", {
      amount: fromFils(amount),
      periods: periodsText || "—",
      org: session.orgName,
    });
    toast.success(t("saved", { amount: money(amount) }), {
      description: `${ctx.tenantName} · ${ctx.unitLabels}`,
      duration: 8000,
      action: {
        label: t("printReceipt"),
        onClick: () => window.open(`/print/receipt/${r.data.id}?lang=${locale}`, "_blank"),
      },
      cancel: ctx.tenantPhone
        ? {
            label: t("whatsapp"),
            onClick: () => window.open(whatsappLink(ctx.tenantPhone!, confirm), "_blank"),
          }
        : undefined,
    });
  };

  const allPeriods = ctx ? [...new Set(ctx.open.map((o) => o.period))].sort() : [];

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={ctx ? `${ctx.tenantName} · ${ctx.propertyName} · ${ctx.unitLabels}` : undefined}
      footer={
        <Button
          block
          size="lg"
          onClick={save}
          loading={saving}
          disabled={!ctx || !amount || (allocMode === "periods" && periods.length === 0)}
        >
          {t("save")} {amount ? `· ${money(amount)}` : ""}
        </Button>
      }
    >
      {!ctx && unavailable ? (
        <p className="text-label-2 py-8 text-center text-[15px] leading-7">
          {tPill("offlineAction")}
        </p>
      ) : !ctx ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-11" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-paper rounded-[16px] p-3">
              <div className="text-label-2 text-[12px]">{t("dueNow")}</div>
              <div
                className={cn(
                  "num text-[18px] font-semibold",
                  ctx.dueNowFils > 0 && "text-red-text",
                )}
              >
                {money(ctx.dueNowFils)}
              </div>
            </div>
            <div className="bg-paper rounded-[16px] p-3">
              <div className="text-label-2 text-[12px]">{t("creditNow")}</div>
              <div className="num text-indigo-text text-[18px] font-semibold">
                {money(ctx.creditFils)}
              </div>
            </div>
          </div>
          <Field label={t("amount")} htmlFor="p-amount">
            <div className="space-y-2">
              <ChipScroller>
                <Chip active={mode === "month"} onClick={() => pickMode("month")}>
                  {t("thisMonth")}
                </Chip>
                <Chip
                  active={mode === "due"}
                  onClick={() => pickMode("due")}
                  disabled={ctx.dueNowFils <= 0}
                >
                  {t("allDue")}
                </Chip>
                <Chip active={mode === "custom"} onClick={() => setMode("custom")}>
                  {t("custom")}
                </Chip>
              </ChipScroller>
              <MoneyInput
                id="p-amount"
                size="lg"
                value={amount}
                onChange={(v) => {
                  setAmount(v);
                  setMode("custom");
                }}
              />
            </div>
          </Field>
          <Field label={t("method")}>
            <SegmentedControl
              size="sm"
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: tMethod(m) }))}
              value={method}
              onChange={setMethod}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("date")} htmlFor="p-date">
              <DatePicker
                id="p-date"
                value={date}
                onChange={(d) => d && setDate(d)}
                max={todayKuwait()}
              />
            </Field>
            <Field label={t("receipt")} htmlFor="p-receipt" hint={t("receiptHint")}>
              <Input
                id="p-receipt"
                inputMode="numeric"
                dir="ltr"
                className="num"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                onBlur={onReceiptBlur}
              />
            </Field>
          </div>
          {dup && (
            <p className="bg-orange/12 text-orange-text flex items-start gap-2 rounded-[14px] px-4 py-3 text-[14px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t("duplicate", { no: receipt, tenant: dup.tenant, date: formatDate(dup.date) })}
            </p>
          )}
          {(method === "cheque" ||
            method === "bank_transfer" ||
            method === "link" ||
            method === "knet") && (
            <Field label={t("reference")} htmlFor="p-ref">
              <Input
                id="p-ref"
                dir="ltr"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          )}
          {can(session.role, "void_payment") && ctx.collectors.length > 1 && (
            <Field label={t("collectedBy")} htmlFor="p-coll">
              <Select id="p-coll" value={collector} onChange={(e) => setCollector(e.target.value)}>
                {ctx.collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label={t("allocation")}>
            <div className="space-y-3">
              <SegmentedControl
                size="sm"
                options={[
                  { value: "fifo", label: t("fifo") },
                  { value: "periods", label: t("choose") },
                ]}
                value={allocMode}
                onChange={setAllocMode}
              />
              {allocMode === "periods" && (
                <ChipScroller>
                  {allPeriods.map((p) => (
                    <Chip
                      key={p}
                      active={periods.includes(p)}
                      onClick={() =>
                        setPeriods((ps) =>
                          ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p],
                        )
                      }
                    >
                      {formatPeriod(p, locale)}
                    </Chip>
                  ))}
                </ChipScroller>
              )}
              <ul className="bg-paper divide-separator divide-y-[0.5px] rounded-[16px]">
                {coveredPeriods.map((c) => (
                  <li
                    key={c.period}
                    className="flex items-center justify-between px-4 py-2.5 text-[14px]"
                  >
                    <span className="flex items-center gap-2">
                      <Check className={cn("size-4", c.full ? "text-green" : "text-orange")} />
                      {formatPeriod(c.period, locale)}
                      <span className="text-label-2 text-[12px]">
                        {c.full ? t("full") : t("partial")}
                      </span>
                    </span>
                    <span className="num">{money(c.paid)}</span>
                  </li>
                ))}
                {preview && preview.creditFils > 0 && (
                  <li className="flex items-center justify-between px-4 py-2.5 text-[14px]">
                    <span className="text-indigo-text">{t("credit")}</span>
                    <span className="num text-indigo-text">{money(preview.creditFils)}</span>
                  </li>
                )}
                {ctx.open.length === 0 && (
                  <li className="text-label-2 px-4 py-3 text-[13px]">{t("nothingDue")}</li>
                )}
              </ul>
              {ctx.open.some((o) => o.kind !== "rent") && (
                <p className="text-label-2 text-[12px]">
                  {[...new Set(ctx.open.map((o) => o.kind))].map((k) => tKind(k)).join(" · ")}
                </p>
              )}
            </div>
          </Field>
          <Field label={t("notes")} htmlFor="p-notes">
            <Textarea
              id="p-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div>
            <Button variant="secondary" onClick={() => photoRef.current?.click()}>
              <Camera />
              {photo ? photo.name : t("attach")}
            </Button>
            <input
              ref={photoRef}
              type="file"
              hidden
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <span className="sr-only">{tc("save")}</span>
        </div>
      )}
    </Sheet>
  );
}
