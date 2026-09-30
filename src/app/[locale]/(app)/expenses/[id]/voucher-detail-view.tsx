"use client";
import { useState } from "react";
import { Printer, XOctagon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { AlertDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/chip";
import { Documents } from "@/components/domain/documents";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { voidVoucher } from "@/server/actions/expenses";
import { formatDate } from "@/domain/dates";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";
import type { AllocationMode } from "@/domain/expenses";

export function VoucherDetailView({
  voucher: v,
  canManage,
}: {
  canManage: boolean;
  voucher: {
    id: string; no: string; date: string; paidFrom: "cash_box" | "bank" | "cheque"; recipient: string | null; reference: string | null; notes: string | null; status: "draft" | "posted" | "void"; voidReason: string | null;
    lines: { amountFils: number; category: string; beneficiary: string; description: string; mode: AllocationMode; allocations: { property: string; unit: string | null; amountFils: number }[] }[];
  };
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const tFrom = useTranslations("enums.paidFrom");
  const tMode = useTranslations("enums.allocationMode");
  const tStatus = useTranslations("enums.voucherStatus");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const total = v.lines.reduce((a, l) => a + l.amountFils, 0);
  return (
    <>
      <LargeTitleHeader
        title={<span className="num">{v.no}</span>}
        subtitle={formatDate(v.date)}
        back={{ href: "/expenses", label: t("title") }}
        actions={<Button asChild variant="secondary" size="icon" aria-label={t("detail.print")}><a href={`/print/voucher/${v.id}?lang=${locale}`} target="_blank" rel="noreferrer"><Printer /></a></Button>}
      >
        <Pill className={v.status === "void" ? "bg-red/14 text-red-text" : "bg-green/14 text-green-text"}>{tStatus(v.status)}{v.voidReason ? ` — ${v.voidReason}` : ""}</Pill>
      </LargeTitleHeader>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="p-6">
            <div className="num text-[36px] font-semibold">{money(total)}</div>
            <p className="text-label-2 mt-1 text-[14px]">{locale === "ar" ? tafqeetKWD(total) : wordsEN(total)}</p>
          </Card>
          {v.lines.map((l, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[16px] font-semibold">{l.category}{l.beneficiary ? ` · ${l.beneficiary}` : ""}</div>
                  <div className="text-label-2 text-[14px]">{l.description}</div>
                </div>
                <div className="num text-[18px] font-semibold">{money(l.amountFils)}</div>
              </div>
              <div className="text-label-2 mt-3 text-[12px]">{tMode(l.mode)}</div>
              <ul className="mt-1 space-y-1 text-[14px]">
                {l.allocations.map((a, k) => (
                  <li key={k} className="flex justify-between"><span>{a.property}{a.unit ? ` · ${a.unit}` : ""}</span><span className="num">{money(a.amountFils)}</span></li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <GroupedSection>
            <ListRow title={t("form.paidFrom")} trailing={tFrom(v.paidFrom)} />
            {v.recipient && <ListRow title={t("form.recipient")} trailing={v.recipient} />}
            {v.reference && <ListRow title={t("form.reference")} trailing={<span className="num">{v.reference}</span>} />}
            {v.notes && <ListRow title={tc("labels.notes")} subtitle={v.notes} />}
          </GroupedSection>
          <Documents entityType="voucher" entityId={v.id} canEdit={canManage && v.status !== "void"} canDelete={canManage} />
          {canManage && v.status === "posted" && (
            <GroupedSection>
              <ListRow leading={<XOctagon className="text-red-text size-5" />} title={t("detail.void")} destructive onClick={() => setConfirm(true)} />
            </GroupedSection>
          )}
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm} title={t("detail.voidConfirm")} confirmLabel={t("detail.void")} cancelLabel={tc("actions.cancel")} destructive loading={pending} confirmDisabled={!reason.trim()} onConfirm={() => exec(() => voidVoucher(v.id, reason), { success: t("detail.voided"), onSuccess: () => { setConfirm(false); router.refresh(); } })}>
        <Textarea aria-label={t("detail.voidReason")} placeholder={t("detail.voidReason")} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </AlertDialog>
    </>
  );
}
