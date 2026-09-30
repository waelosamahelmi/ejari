"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedControl } from "@/components/ui/segmented";
import { useAction } from "@/hooks/use-action";
import { saveLegalCase, type LegalCaseInput } from "@/server/actions/legal";
import { LEGAL_STATUSES } from "@/domain/types";

const BLANK: LegalCaseInput = { tenantId: "", contractId: null, caseNo: "", court: "", type: "rent_claim", status: "filed", amountClaimedFils: 0, nextHearingDate: null, lawyer: "", notes: "" };

export function LegalCaseSheet({ open, onOpenChange, value, tenants, contracts }: { open: boolean; onOpenChange: (o: boolean) => void; value: (LegalCaseInput & { id?: string }) | null; tenants: { id: string; name: string }[]; contracts: { id: string; tenantId: string; label: string }[] }) {
  const t = useTranslations("legal");
  const tType = useTranslations("enums.legalType");
  const tStatus = useTranslations("enums.legalStatus");
  const tc = useTranslations("common.actions");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [v, setV] = useState<LegalCaseInput>(BLANK);
  useEffect(() => {
    if (open) setV(value ?? BLANK);
  }, [open, value]);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={value?.id ? t("edit") : t("new")}
      footer={<Button block size="lg" loading={pending} disabled={!v.tenantId} onClick={() => exec(() => saveLegalCase(value?.id ?? null, v), { success: t("saved"), onSuccess: (id) => { onOpenChange(false); router.push(`/legal/${id}`); router.refresh(); } })}>{tc("save")}</Button>}
    >
      <div className="space-y-4">
        <Field label={t("fields.tenant")} htmlFor="lc-tenant">
          <Select id="lc-tenant" value={v.tenantId} onChange={(e) => setV({ ...v, tenantId: e.target.value, contractId: contracts.find((c) => c.tenantId === e.target.value)?.id ?? null })}>
            <option value="">—</option>
            {tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </Field>
        <Field label={t("fields.contract")} htmlFor="lc-contract">
          <Select id="lc-contract" value={v.contractId ?? ""} onChange={(e) => setV({ ...v, contractId: e.target.value || null })}>
            <option value="">{t("noContract")}</option>
            {contracts.filter((c) => c.tenantId === v.tenantId).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label={t("fields.type")}>
          <SegmentedControl options={(["eviction", "rent_claim", "other"] as const).map((k) => ({ value: k, label: tType(k) }))} value={v.type} onChange={(k) => setV({ ...v, type: k })} />
        </Field>
        <Field label={t("fields.status")} htmlFor="lc-status">
          <Select id="lc-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as LegalCaseInput["status"] })}>
            {LEGAL_STATUSES.filter((s) => s !== "none").map((s) => <option key={s} value={s}>{tStatus(s)}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("fields.caseNo")} htmlFor="lc-no"><Input id="lc-no" value={v.caseNo ?? ""} onChange={(e) => setV({ ...v, caseNo: e.target.value })} /></Field>
          <Field label={t("fields.nextHearing")} htmlFor="lc-next"><DatePicker id="lc-next" value={v.nextHearingDate ?? null} onChange={(d) => setV({ ...v, nextHearingDate: d })} /></Field>
        </div>
        <Field label={t("fields.court")} htmlFor="lc-court"><Input id="lc-court" value={v.court ?? ""} onChange={(e) => setV({ ...v, court: e.target.value })} /></Field>
        <Field label={t("fields.amount")} htmlFor="lc-amt"><MoneyInput id="lc-amt" value={v.amountClaimedFils || null} onChange={(f) => setV({ ...v, amountClaimedFils: f ?? 0 })} /></Field>
        <Field label={t("fields.lawyer")} htmlFor="lc-lawyer"><Input id="lc-lawyer" value={v.lawyer ?? ""} onChange={(e) => setV({ ...v, lawyer: e.target.value })} /></Field>
        <Field label={t("fields.notes")} htmlFor="lc-notes"><Textarea id="lc-notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}
