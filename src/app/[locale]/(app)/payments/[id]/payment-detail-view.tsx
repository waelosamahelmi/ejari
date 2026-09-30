"use client";
import { useState } from "react";
import { Paperclip, Printer, XOctagon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { AlertDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/chip";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { voidPayment } from "@/server/actions/payments";
import { formatDate, formatPeriod } from "@/domain/dates";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";
import type { PaymentMethod } from "@/domain/types";

export function PaymentDetailView({
  payment: p,
  canVoid,
}: {
  canVoid: boolean;
  payment: {
    id: string; receiptNo: string | null; systemNo: string | null; amountFils: number; method: PaymentMethod; date: string; reference: string | null; notes: string | null;
    voided: boolean; voidReason: string | null; tenantId: string; tenant: string; contractId: string; contractNo: string; unit: string; collector: string;
    allocations: { amountFils: number; period: string; kind: string }[]; creditFils: number; attachmentUrl: string | null;
  };
}) {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const tMethod = useTranslations("enums.paymentMethod");
  const tKind = useTranslations("enums.chargeKind");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <LargeTitleHeader
        title={t("detail.title", { no: p.receiptNo ?? p.systemNo ?? "" })}
        subtitle={p.tenant}
        back={{ href: "/payments", label: t("title") }}
        actions={
          <Button asChild variant="secondary" size="icon" aria-label={t("detail.print")}>
            <a href={`/print/receipt/${p.id}?lang=${locale}`} target="_blank" rel="noreferrer"><Printer /></a>
          </Button>
        }
      >
        {p.voided && <Pill className="bg-red/14 text-red-text h-7 px-3">{t("detail.voidedBadge")}{p.voidReason ? ` — ${p.voidReason}` : ""}</Pill>}
      </LargeTitleHeader>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="p-6">
            <div className="num text-[40px] font-semibold">{money(p.amountFils)}</div>
            <p className="text-label-2 mt-1 text-[14px]">{locale === "ar" ? tafqeetKWD(p.amountFils) : wordsEN(p.amountFils)}</p>
          </Card>
          <GroupedSection>
            <ListRow title={t("columns.date")} trailing={<span className="num">{formatDate(p.date)}</span>} />
            <ListRow title={t("columns.method")} trailing={tMethod(p.method)} />
            {p.reference && <ListRow title={t("sheet.reference")} trailing={<span className="num">{p.reference}</span>} />}
            <ListRow title={t("columns.system")} trailing={<span className="num">{p.systemNo}</span>} />
            <ListRow title={t("columns.collector")} trailing={p.collector} />
            <ListRow LinkComponent={Link} href={`/tenants/${p.tenantId}`} title={t("columns.tenant")} trailing={p.tenant} chevron />
            <ListRow LinkComponent={Link} href={`/contracts/${p.contractId}`} title={tc("labels.contract")} trailing={<span className="num">{p.contractNo}</span>} subtitle={p.unit} chevron />
            {p.notes && <ListRow title={tc("labels.notes")} subtitle={p.notes} />}
            {p.attachmentUrl && <ListRow leading={<Paperclip className="size-5" />} title={t("detail.attachment")} href={p.attachmentUrl} LinkComponent={(x: React.ComponentProps<"a">) => <a {...x} target="_blank" rel="noreferrer" />} chevron />}
          </GroupedSection>
        </div>
        <div className="space-y-5">
          <GroupedSection header={t("detail.allocations")}>
            {p.allocations.map((a, i) => (
              <ListRow key={i} title={formatPeriod(a.period, locale)} subtitle={tKind(a.kind as "rent")} trailing={<span className="num">{money(a.amountFils)}</span>} />
            ))}
            {p.creditFils > 0 && <ListRow title={<span className="text-indigo-text">{t("detail.unallocated")}</span>} trailing={<span className="num text-indigo-text">{money(p.creditFils)}</span>} />}
          </GroupedSection>
          {canVoid && !p.voided && (
            <GroupedSection>
              <ListRow leading={<XOctagon className="text-red-text size-5" />} title={t("detail.void")} destructive onClick={() => setConfirm(true)} />
            </GroupedSection>
          )}
        </div>
      </div>
      <AlertDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("detail.voidConfirm")}
        description={t("detail.voidText")}
        confirmLabel={t("detail.void")}
        cancelLabel={tc("actions.cancel")}
        destructive
        loading={pending}
        confirmDisabled={!reason.trim()}
        onConfirm={() => exec(() => voidPayment(p.id, reason), { success: t("detail.voided"), onSuccess: () => { setConfirm(false); router.refresh(); } })}
      >
        <Textarea aria-label={t("detail.voidReason")} placeholder={t("detail.voidReason")} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </AlertDialog>
    </>
  );
}
