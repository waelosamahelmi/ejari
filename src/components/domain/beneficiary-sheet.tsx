"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { MoneyInput } from "@/components/ui/money-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Toggle } from "@/components/ui/toggle";
import { saveBeneficiary } from "@/server/actions/master";
import { useAction } from "@/hooks/use-action";

export interface BeneficiaryRow {
  id: string;
  name: string;
  kind: "staff" | "vendor" | "asset" | "other";
  phone: string;
  monthlySalaryFils: number | null;
  notes: string;
  active: boolean;
}

const BLANK: BeneficiaryRow = {
  id: "",
  name: "",
  kind: "staff",
  phone: "",
  monthlySalaryFils: null,
  notes: "",
  active: true,
};

/** Create/edit beneficiary (also used inline from the voucher line editor). */
export function BeneficiarySheet({
  open,
  onOpenChange,
  row,
  onSaved,
  initialName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: BeneficiaryRow | null;
  onSaved?: (b: { id: string; name: string }) => void;
  initialName?: string;
}) {
  const t = useTranslations("catalog.beneficiaries");
  const tKind = useTranslations("enums.beneficiaryKind");
  const tc = useTranslations("common.actions");
  const { exec, pending } = useAction();
  const [v, setV] = useState<BeneficiaryRow>(BLANK);
  useEffect(() => {
    if (open) setV(row ?? { ...BLANK, name: initialName ?? "" });
  }, [open, row, initialName]);
  const save = () =>
    exec(() => saveBeneficiary(v.id || null, v), {
      success: t("saved"),
      onSuccess: (b) => {
        onOpenChange(false);
        onSaved?.(b);
      },
    });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={v.id ? v.name : t("new")}
      footer={
        <Button block size="lg" onClick={save} loading={pending} disabled={!v.name.trim()}>
          {tc("save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t("name")} htmlFor="b-name">
          <Input
            id="b-name"
            autoFocus
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </Field>
        <Field label={t("kind")}>
          <SegmentedControl
            size="sm"
            options={(["staff", "vendor", "asset", "other"] as const).map((k) => ({
              value: k,
              label: tKind(k),
            }))}
            value={v.kind}
            onChange={(k) => setV({ ...v, kind: k })}
          />
        </Field>
        {v.kind === "staff" && (
          <Field label={t("salary")} htmlFor="b-sal">
            <MoneyInput
              id="b-sal"
              value={v.monthlySalaryFils}
              onChange={(f) => setV({ ...v, monthlySalaryFils: f })}
            />
          </Field>
        )}
        <Field label={t("phone")} htmlFor="b-phone">
          <PhoneInput
            id="b-phone"
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
          />
        </Field>
        <Field label={t("notes")} htmlFor="b-notes">
          <Textarea
            id="b-notes"
            value={v.notes}
            onChange={(e) => setV({ ...v, notes: e.target.value })}
          />
        </Field>
        <label className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-3">
          <span>{t("active")}</span>
          <Toggle
            checked={v.active}
            onCheckedChange={(a) => setV({ ...v, active: a })}
            ariaLabel={t("active")}
          />
        </label>
      </div>
    </Sheet>
  );
}
