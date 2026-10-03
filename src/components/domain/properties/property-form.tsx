"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { MoneyInput } from "@/components/ui/money-input";
import { Wizard } from "@/components/ui/wizard";
import {
  KUWAIT_GOVERNORATES,
  OTHER_AREA,
  areaAfterGovernorateChange,
} from "@/data/kuwait-addresses";
import { generatePlannedUnits, type PlannedUnit, type UnitPlanRow } from "@/domain/unit-plan";
import {
  UnitPlanValidation,
  UnitPlanner,
  defaultRow,
  isUnitPlanValid,
} from "@/components/domain/units/unit-planner";
import { propertySchema, type PropertyInput } from "@/lib/schemas/master";
import { createPropertyWithPlan, saveProperty } from "@/server/actions/master";
import { useAction, useFieldError } from "@/hooks/use-action";

// Sheets are code-split: they load after hydration instead of with the page.
const OwnerFormSheet = dynamic(
  () => import("@/components/domain/owners/owner-form").then((m) => m.OwnerFormSheet),
  { ssr: false },
);

export type PropertyFormValue = PropertyInput & { id: string };

const EMPTY: PropertyInput = {
  name: "",
  nameEn: "",
  governorate: "",
  area: "",
  block: "",
  street: "",
  avenue: "",
  houseOrPlot: "",
  paciNo: "",
  propertyType: "residential",
  floors: null,
  notes: "",
  owners: [],
  commission: null,
};

export function PropertyFormSheet({
  open,
  onOpenChange,
  property,
  owners,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  property?: PropertyFormValue | null;
  owners: { id: string; fullName: string }[];
  onSaved?: (id: string) => void;
}) {
  const t = useTranslations("properties");
  const tc = useTranslations("common.actions");
  const tEnum = useTranslations("enums");
  const locale = useLocale() as "ar" | "en";
  const fe = useFieldError();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [ownerSheet, setOwnerSheet] = useState(false);
  const isCreate = !property;
  const [step, setStep] = useState<"details" | "units">("details");
  const [unitMode, setUnitMode] = useState<"now" | "later">("now");
  const [planRows, setPlanRows] = useState<UnitPlanRow[]>([]);
  const [planned, setPlanned] = useState<PlannedUnit[]>([]);
  const form = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
    mode: "onBlur",
    defaultValues: EMPTY,
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = form;
  const ownerRows = useFieldArray({ control, name: "owners" });
  useEffect(() => {
    if (!open) return;
    form.reset(
      property ?? { ...EMPTY, owners: owners[0] ? [{ ownerId: owners[0].id, sharePct: 100 }] : [] },
    );
    setStep("details");
    setUnitMode("now");
    setPlanRows([]);
    setPlanned([]);
  }, [open, property, owners, form]);
  const commission = watch("commission");
  const governorate = watch("governorate");
  const selectedGov = KUWAIT_GOVERNORATES.find((g) => g.value === governorate);
  const areaOptions = selectedGov?.areas ?? [];
  const unitsValid = unitMode === "later" || isUnitPlanValid(planRows, planned, []);

  const moveToUnits = () => {
    setPlanRows((r) => {
      if (r.length) return r;
      const init = [defaultRow(0)];
      setPlanned(generatePlannedUnits(init));
      return init;
    });
    setStep("units");
  };

  const onValid = (v: PropertyInput) => {
    if (!property && step === "details") {
      moveToUnits();
      return;
    }
    const success = {
      success: t("saved"),
      onSuccess: (id: string) => {
        onOpenChange(false);
        onSaved?.(id);
        router.refresh();
      },
    };
    if (!property) {
      return exec(
        () =>
          createPropertyWithPlan({
            property: v,
            units: unitMode === "later" ? [] : planned,
          }),
        success,
      );
    }
    return exec(() => saveProperty(property.id, v), success);
  };

  const submit = handleSubmit(onValid);
  const nextStep = async () => {
    if (await form.trigger()) moveToUnits();
  };

  const fields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.name")} htmlFor="p-name" error={fe(errors.name?.message)}>
          <Input id="p-name" autoFocus {...register("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label={t("fields.nameEn")} htmlFor="p-name-en">
          <Input id="p-name-en" dir="ltr" {...register("nameEn")} />
        </Field>
      </div>
      <Field label={t("fields.type")}>
        <Controller
          control={control}
          name="propertyType"
          render={({ field }) => (
            <SegmentedControl
              options={(["residential", "investment", "mixed", "industrial"] as const).map((v) => ({
                value: v,
                label: tEnum(`propertyType.${v}`),
              }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("fields.governorate")}
          htmlFor="p-governorate"
          error={fe(errors.governorate?.message)}
        >
          <Controller
            control={control}
            name="governorate"
            render={({ field }) => (
              <Select
                id="p-governorate"
                value={field.value ?? ""}
                aria-invalid={!!errors.governorate}
                onChange={(e) => {
                  const next = e.target.value;
                  field.onChange(next);
                  setValue("area", areaAfterGovernorateChange(form.getValues("area"), next), {
                    shouldValidate: true,
                  });
                }}
              >
                <option value="">{t("fields.selectGovernorate")}</option>
                {KUWAIT_GOVERNORATES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {locale === "en" ? g.en : g.ar}
                  </option>
                ))}
                {field.value && !selectedGov ? (
                  <option value={field.value}>{field.value}</option>
                ) : null}
              </Select>
            )}
          />
        </Field>
        <Field label={t("fields.area")} htmlFor="p-area" error={fe(errors.area?.message)}>
          <Controller
            control={control}
            name="area"
            render={({ field }) => (
              <Select
                id="p-area"
                value={field.value ?? ""}
                disabled={!governorate}
                aria-invalid={!!errors.area}
                onChange={(e) => field.onChange(e.target.value)}
              >
                <option value="">{t("fields.selectArea")}</option>
                {areaOptions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {locale === "en" ? a.en : a.ar}
                  </option>
                ))}
                <option value={OTHER_AREA.value}>
                  {locale === "en" ? OTHER_AREA.en : OTHER_AREA.ar}
                </option>
                {field.value &&
                field.value !== OTHER_AREA.value &&
                !areaOptions.some((a) => a.value === field.value) ? (
                  <option value={field.value}>{field.value}</option>
                ) : null}
              </Select>
            )}
          />
        </Field>
        <Field label={t("fields.block")} htmlFor="p-block" error={fe(errors.block?.message)}>
          <Input id="p-block" inputMode="numeric" {...register("block")} aria-invalid={!!errors.block} />
        </Field>
        <Field label={t("fields.street")} htmlFor="p-street" error={fe(errors.street?.message)}>
          <Input id="p-street" {...register("street")} aria-invalid={!!errors.street} />
        </Field>
        <Field label={t("fields.avenue")} htmlFor="p-avenue">
          <Input id="p-avenue" {...register("avenue")} />
        </Field>
        <Field
          label={t("fields.houseOrPlot")}
          htmlFor="p-house"
          error={fe(errors.houseOrPlot?.message)}
        >
          <Input id="p-house" {...register("houseOrPlot")} aria-invalid={!!errors.houseOrPlot} />
        </Field>
        <Field label={t("fields.paciNo")} htmlFor="p-paci" error={fe(errors.paciNo?.message)}>
          <Input
            id="p-paci"
            dir="ltr"
            inputMode="numeric"
            maxLength={8}
            className="num"
            {...register("paciNo")}
          />
        </Field>
      </div>
      <Field label={t("fields.floors")} htmlFor="p-floors">
        <Input
          id="p-floors"
          type="number"
          inputMode="numeric"
          min={0}
          {...register("floors", {
            setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
          })}
        />
      </Field>

      <Field
        label={t("fields.owners")}
        error={fe(errors.owners?.message ?? errors.owners?.root?.message)}
      >
        <div className="space-y-2">
          {ownerRows.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Select aria-label={t("fields.owners")} {...register(`owners.${i}.ownerId`)}>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                aria-label={t("fields.share")}
                className="num w-24 text-center"
                inputMode="decimal"
                {...register(`owners.${i}.sharePct`, { setValueAs: (v) => Number(v) })}
              />
              <button
                type="button"
                aria-label={tc("remove")}
                onClick={() => ownerRows.remove(i)}
                className="bg-inset text-label-2 flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-4 px-1">
            {owners.length > 0 && (
              <button
                type="button"
                onClick={() => ownerRows.append({ ownerId: owners[0]!.id, sharePct: 0 })}
                className="text-link flex items-center gap-1 text-[14px] font-medium"
              >
                <Plus className="size-4" />
                {t("fields.addOwner")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOwnerSheet(true)}
              className="text-link flex items-center gap-1 text-[14px] font-medium"
            >
              <Plus className="size-4" />
              {tc("create")}
            </button>
          </div>
        </div>
      </Field>

      <Field label={t("fields.commission")}>
        <div className="space-y-3">
          <SegmentedControl
            options={[
              { value: "none", label: t("fields.commissionNone") },
              { value: "percent", label: tEnum("commissionKind.percent") },
              { value: "fixed", label: tEnum("commissionKind.fixed") },
            ]}
            value={commission ? commission.kind : "none"}
            onChange={(k) =>
              setValue("commission", k === "none" ? null : { kind: k as "percent" | "fixed", value: 0 }, {
                shouldDirty: true,
              })
            }
          />
          {commission?.kind === "percent" && (
            <Input
              aria-label={t("fields.commissionValuePct")}
              inputMode="decimal"
              className="num"
              value={commission.value}
              onChange={(e) =>
                setValue("commission", { kind: "percent", value: Number(e.target.value) || 0 })
              }
            />
          )}
          {commission?.kind === "fixed" && (
            <MoneyInput
              value={commission.value}
              onChange={(v) => setValue("commission", { kind: "fixed", value: v ?? 0 })}
              showWords={false}
            />
          )}
        </div>
      </Field>

      <Field label={t("fields.notes")} htmlFor="p-notes">
        <Textarea id="p-notes" {...register("notes")} />
      </Field>
    </>
  );

  const unitsStep = (
    <div className="space-y-4">
      <Field label={t("unitsModeLabel")}>
        <SegmentedControl
          options={[
            { value: "now", label: t("unitsMode.now") },
            { value: "later", label: t("unitsMode.later") },
          ]}
          value={unitMode}
          onChange={(v) => setUnitMode(v as "now" | "later")}
        />
      </Field>
      {unitMode === "later" ? (
        <p className="text-label-2 text-[14px]">{t("unitsLaterHint")}</p>
      ) : (
        <>
          <UnitPlanner
            rows={planRows}
            units={planned}
            onChange={(v) => {
              setPlanRows(v.rows);
              setPlanned(v.units);
            }}
          />
          <UnitPlanValidation rows={planRows} units={planned} />
        </>
      )}
    </div>
  );

  const footer =
    isCreate && step === "details" ? (
      <Button block size="lg" type="button" onClick={() => void nextStep()}>
        {t("next")}
      </Button>
    ) : isCreate ? (
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" type="button" onClick={() => setStep("details")}>
          {t("back")}
        </Button>
        <Button block size="lg" onClick={submit} loading={pending} disabled={!unitsValid}>
          {t("create")}
        </Button>
      </div>
    ) : (
      <Button block size="lg" onClick={submit} loading={pending}>
        {tc("save")}
      </Button>
    );

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title={property ? t("edit") : t("new")}
        footer={footer}
      >
        {isCreate ? (
          <Wizard
            steps={[t("steps.details"), t("steps.units")]}
            current={step === "details" ? 0 : 1}
            onBack={() => setStep("details")}
            onNext={() => void nextStep()}
            hideFooter
          >
            {step === "details" ? (
              <form onSubmit={submit} className="space-y-5">
                {fields}
                <button type="submit" hidden />
              </form>
            ) : (
              unitsStep
            )}
          </Wizard>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {fields}
            <button type="submit" hidden />
          </form>
        )}
      </Sheet>
      <OwnerFormSheet
        open={ownerSheet}
        onOpenChange={setOwnerSheet}
        onSaved={(id) => {
          const rows = form.getValues("owners");
          form.setValue(
            "owners",
            rows.length ? [...rows, { ownerId: id, sharePct: 0 }] : [{ ownerId: id, sharePct: 100 }],
          );
        }}
      />
    </>
  );
}
