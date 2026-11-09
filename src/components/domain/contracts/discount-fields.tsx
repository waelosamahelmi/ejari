"use client";
import { useTranslations } from "next-intl";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";

export interface DiscountInput {
  fromPeriod: string;
  toPeriod: string;
  amountFils: number;
  reason: string;
}
export function DiscountFields({
  value,
  onChange,
}: {
  value: DiscountInput;
  onChange: (v: DiscountInput) => void;
}) {
  const t = useTranslations("contracts.discount");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("from")} htmlFor="discount-from">
        <Input
          id="discount-from"
          type="month"
          required
          value={value.fromPeriod}
          onChange={(e) => onChange({ ...value, fromPeriod: e.target.value })}
        />
      </Field>
      <Field label={t("to")} htmlFor="discount-to">
        <Input
          id="discount-to"
          type="month"
          required
          min={value.fromPeriod}
          value={value.toPeriod}
          onChange={(e) => onChange({ ...value, toPeriod: e.target.value })}
        />
      </Field>
      <Field label={t("amount")} htmlFor="discount-amount">
        <MoneyInput
          id="discount-amount"
          value={value.amountFils}
          onChange={(n) => onChange({ ...value, amountFils: n ?? 0 })}
        />
      </Field>
      <Field label={t("reason")} htmlFor="discount-reason">
        <Input
          id="discount-reason"
          required
          maxLength={500}
          value={value.reason}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
        />
      </Field>
    </div>
  );
}
