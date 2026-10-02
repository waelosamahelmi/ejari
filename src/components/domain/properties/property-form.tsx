"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { MoneyInput } from "@/components/ui/money-input";
import { propertySchema, type PropertyInput } from "@/lib/schemas/master";
import { saveProperty } from "@/server/actions/master";
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
  const fe = useFieldError();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [ownerSheet, setOwnerSheet] = useState(false);
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
  }, [open, property, owners, form]);
  const commission = watch("commission");
  const submit = handleSubmit((v) =>
    exec(() => saveProperty(property?.id ?? null, v), {
      success: t("saved"),
      onSuccess: (id) => {
        onOpenChange(false);
        onSaved?.(id);
        router.refresh();
      },
    }),
  );

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title={property ? t("edit") : t("new")}
        footer={
          <Button block size="lg" onClick={submit} loading={pending}>
            {tc("save")}
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-5">
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
                  options={(["residential", "investment", "mixed", "industrial"] as const).map(
                    (v) => ({ value: v, label: tEnum(`propertyType.${v}`) }),
                  )}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t("fields.area")} htmlFor="p-area" className="col-span-2 sm:col-span-1">
              <Input id="p-area" {...register("area")} />
            </Field>
            <Field label={t("fields.block")} htmlFor="p-block">
              <Input id="p-block" inputMode="numeric" {...register("block")} />
            </Field>
            <Field label={t("fields.street")} htmlFor="p-street">
              <Input id="p-street" {...register("street")} />
            </Field>
            <Field label={t("fields.avenue")} htmlFor="p-avenue">
              <Input id="p-avenue" {...register("avenue")} />
            </Field>
            <Field label={t("fields.houseOrPlot")} htmlFor="p-house">
              <Input id="p-house" {...register("houseOrPlot")} />
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
                  setValue(
                    "commission",
                    k === "none" ? null : { kind: k as "percent" | "fixed", value: 0 },
                    { shouldDirty: true },
                  )
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
          <button type="submit" hidden />
        </form>
      </Sheet>
      <OwnerFormSheet
        open={ownerSheet}
        onOpenChange={setOwnerSheet}
        onSaved={(id) => {
          const rows = form.getValues("owners");
          form.setValue(
            "owners",
            rows.length
              ? [...rows, { ownerId: id, sharePct: 0 }]
              : [{ ownerId: id, sharePct: 100 }],
          );
        }}
      />
    </>
  );
}
