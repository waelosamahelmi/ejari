"use client";
import { useTranslations } from "next-intl";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { MonthPicker } from "@/components/ui/month-picker";

export interface DiscountInput {
  fromPeriod: string;
  toPeriod: string | null;
  amountFils: number;
  reason: string;
}
export function DiscountFields({
  value,
  onChange,
  minPeriod,
  maxPeriod,
  rentFils,
}: {
  value: DiscountInput;
  onChange: (v: DiscountInput) => void;
  minPeriod?: string;
  maxPeriod?: string;
  rentFils?: number;
}) {
  const t = useTranslations("contracts.discount");
  const invalidPeriod =
    (minPeriod && value.fromPeriod < minPeriod) ||
    (maxPeriod && value.fromPeriod > maxPeriod) ||
    (value.toPeriod !== null &&
      (value.toPeriod < value.fromPeriod || (maxPeriod && value.toPeriod > maxPeriod)));
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
        <input
          type="checkbox"
          checked={value.toPeriod === null}
          onChange={(e) =>
            onChange({ ...value, toPeriod: e.target.checked ? null : value.fromPeriod })
          }
        />
        {t("openEnded")}
      </label>
      {value.toPeriod === null && (
        <p className="text-label-2 text-sm sm:col-span-2">{t("openEndedHelp")}</p>
      )}
      <Field
        label={t("from")}
        htmlFor="discount-from"
        error={invalidPeriod ? t("invalidPeriod") : undefined}
      >
        <MonthPicker
          id="discount-from"
          label={t("from")}
          value={value.fromPeriod}
          min={minPeriod}
          max={maxPeriod}
          onChange={(fromPeriod) =>
            onChange({
              ...value,
              fromPeriod,
              toPeriod:
                value.toPeriod !== null && value.toPeriod < fromPeriod
                  ? fromPeriod
                  : value.toPeriod,
            })
          }
        />
      </Field>
      {value.toPeriod !== null && (
        <Field label={t("to")} htmlFor="discount-to">
          <MonthPicker
            id="discount-to"
            label={t("to")}
            value={value.toPeriod}
            min={value.fromPeriod}
            max={maxPeriod}
            onChange={(toPeriod) => onChange({ ...value, toPeriod })}
          />
        </Field>
      )}
      <Field
        label={t("amount")}
        htmlFor="discount-amount"
        error={
          value.amountFils <= 0 || (rentFils !== undefined && value.amountFils > rentFils)
            ? t("invalidAmount")
            : undefined
        }
      >
        <MoneyInput
          id="discount-amount"
          value={value.amountFils}
          onChange={(n) => onChange({ ...value, amountFils: n ?? 0 })}
        />
      </Field>
      <Field
        label={t("reason")}
        htmlFor="discount-reason"
        error={!value.reason.trim() ? t("requiredReason") : undefined}
      >
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
