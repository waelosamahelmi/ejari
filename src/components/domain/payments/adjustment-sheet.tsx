"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { useAction } from "@/hooks/use-action";
import { addAdjustment, addManualCharge, getPaymentContext } from "@/server/actions/payments";
import { formatPeriod, todayKuwait } from "@/domain/dates";
import type { OpenCharge } from "@/domain/allocation";

/** Discount / write-off / correction against a charge (mandatory reason). */
export function AdjustmentSheet({ open, onOpenChange, contractId }: { open: boolean; onOpenChange: (o: boolean) => void; contractId: string }) {
  const t = useTranslations("payments.adjust");
  const tKind = useTranslations("enums.adjustmentKind");
  const tCharge = useTranslations("enums.chargeKind");
  const tc = useTranslations("common.actions");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open_, setOpen] = useState<OpenCharge[]>([]);
  const [kind, setKind] = useState<"discount" | "write_off" | "correction">("discount");
  const [chargeId, setChargeId] = useState<string>("");
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!open) return;
    setReason("");
    setAmount(null);
    void getPaymentContext(contractId).then((r) => {
      if (r.ok) {
        setOpen(r.data.open);
        setChargeId(r.data.open[0]?.id ?? "");
      }
    });
  }, [open, contractId]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      footer={
        <Button block size="lg" loading={pending} disabled={!amount || !reason.trim()} onClick={() => exec(() => addAdjustment({ contractId, chargeId: chargeId || null, kind, amountFils: amount ?? 0, date: todayKuwait(), reason }), { success: t("saved"), onSuccess: () => { onOpenChange(false); router.refresh(); } })}>
          {tc("save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t("kind")}>
          <SegmentedControl options={(["discount", "write_off", "correction"] as const).map((k) => ({ value: k, label: tKind(k) }))} value={kind} onChange={setKind} />
        </Field>
        <Field label={t("charge")} htmlFor="adj-charge">
          <Select id="adj-charge" value={chargeId} onChange={(e) => setChargeId(e.target.value)}>
            {open_.map((o) => (
              <option key={o.id} value={o.id}>{formatPeriod(o.period, locale)} · {tCharge(o.kind)} · {(o.outstandingFils / 1000).toFixed(3)}</option>
            ))}
            <option value="">{t("none")}</option>
          </Select>
        </Field>
        <Field label={t("amount")} htmlFor="adj-amt"><MoneyInput id="adj-amt" value={amount} onChange={setAmount} /></Field>
        <Field label={t("reason")} htmlFor="adj-reason"><Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

/** Manual charge: penalty, maintenance recharge or other. */
export function ManualChargeSheet({ open, onOpenChange, contractId }: { open: boolean; onOpenChange: (o: boolean) => void; contractId: string }) {
  const tCharge = useTranslations("enums.chargeKind");
  const tc = useTranslations("common");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [kind, setKind] = useState<"penalty" | "maintenance_recharge" | "other">("maintenance_recharge");
  const [amount, setAmount] = useState<number | null>(null);
  const [due, setDue] = useState(todayKuwait());
  const [desc, setDesc] = useState("");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={tCharge(kind)}
      footer={
        <Button block size="lg" loading={pending} disabled={!amount || !desc.trim()} onClick={() => exec(() => addManualCharge({ contractId, kind, amountFils: amount ?? 0, dueDate: due, description: desc }), { onSuccess: () => { onOpenChange(false); router.refresh(); } })}>
          {tc("actions.save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <SegmentedControl options={(["maintenance_recharge", "penalty", "other"] as const).map((k) => ({ value: k, label: tCharge(k) }))} value={kind} onChange={setKind} />
        <Field label={tc("labels.amount")} htmlFor="mc-amt"><MoneyInput id="mc-amt" value={amount} onChange={setAmount} /></Field>
        <Field label={tc("labels.date")} htmlFor="mc-due"><DatePicker id="mc-due" value={due} onChange={(d) => d && setDue(d)} /></Field>
        <Field label={tc("labels.description")} htmlFor="mc-desc"><Input id="mc-desc" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}
