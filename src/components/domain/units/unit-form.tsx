"use client";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Toggle } from "@/components/ui/toggle";
import { unitSchema, type UnitInput } from "@/lib/schemas/master";
import { saveUnit } from "@/server/actions/master";
import { useAction, useFieldError } from "@/hooks/use-action";
import { UNIT_TYPES } from "@/domain/types";

const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

export function UnitFormSheet({ open, onOpenChange, propertyId, unit }: { open: boolean; onOpenChange: (o: boolean) => void; propertyId: string; unit?: (UnitInput & { id: string }) | null }) {
  const t = useTranslations("units");
  const tc = useTranslations("common.actions");
  const tType = useTranslations("enums.unitType");
  const fe = useFieldError();
  const router = useRouter();
  const { exec, pending } = useAction();
  const blank: UnitInput = { propertyId, label: "", type: "apartment", floor: 1, askingRentFils: 0, active: true, sortOrder: 0 };
  const form = useForm<UnitInput>({ resolver: zodResolver(unitSchema), mode: "onBlur", defaultValues: blank });
  const { register, control, handleSubmit, formState: { errors } } = form;
  useEffect(() => {
    if (open) form.reset(unit ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit]);
  const submit = handleSubmit((v) =>
    exec(() => saveUnit(unit?.id ?? null, v), {
      success: t("saved"),
      onSuccess: () => {
        onOpenChange(false);
        router.refresh();
      },
    }),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={unit ? t("edit") : t("new")} footer={<Button block size="lg" onClick={submit} loading={pending}>{tc("save")}</Button>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("fields.label")} htmlFor="u-label" error={fe(errors.label?.message)}>
            <Input id="u-label" autoFocus {...register("label")} aria-invalid={!!errors.label} />
          </Field>
          <Field label={t("fields.type")} htmlFor="u-type">
            <Select id="u-type" {...register("type")}>
              {UNIT_TYPES.map((u) => (
                <option key={u} value={u}>{tType(u)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.floor")} htmlFor="u-floor" hint={t("floorHint")} className="col-span-2 sm:col-span-1">
            <Input id="u-floor" type="number" inputMode="numeric" {...register("floor", { setValueAs: num })} />
          </Field>
          <Field label={t("fields.area")} htmlFor="u-area" className="col-span-2 sm:col-span-1">
            <Input id="u-area" inputMode="decimal" {...register("areaM2", { setValueAs: num })} />
          </Field>
          <Field label={t("fields.bedrooms")} htmlFor="u-bed"><Input id="u-bed" type="number" inputMode="numeric" min={0} {...register("bedrooms", { setValueAs: num })} /></Field>
          <Field label={t("fields.bathrooms")} htmlFor="u-bath"><Input id="u-bath" type="number" inputMode="numeric" min={0} {...register("bathrooms", { setValueAs: num })} /></Field>
        </div>
        <Field label={t("fields.askingRent")} htmlFor="u-rent" error={fe(errors.askingRentFils?.message)}>
          <Controller control={control} name="askingRentFils" render={({ field }) => <MoneyInput id="u-rent" value={field.value ?? 0} onChange={(v) => field.onChange(v ?? 0)} />} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("fields.paci")} htmlFor="u-paci" error={fe(errors.paciNo?.message)} className="col-span-2">
            <Input id="u-paci" dir="ltr" inputMode="numeric" maxLength={8} className="num" {...register("paciNo")} />
          </Field>
          <Field label={t("fields.elecMeter")} htmlFor="u-elec"><Input id="u-elec" dir="ltr" className="num" {...register("elecMeterNo")} /></Field>
          <Field label={t("fields.waterMeter")} htmlFor="u-water"><Input id="u-water" dir="ltr" className="num" {...register("waterMeterNo")} /></Field>
        </div>
        <Field label={t("fields.notes")} htmlFor="u-notes"><Textarea id="u-notes" {...register("notes")} /></Field>
        <label className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-3">
          <span className="text-[16px]">{t("fields.active")}</span>
          <Controller control={control} name="active" render={({ field }) => <Toggle checked={!!field.value} onCheckedChange={field.onChange} ariaLabel={t("fields.active")} />} />
        </label>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
