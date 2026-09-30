"use client";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { CivilIdInput, civilIdStatus } from "@/components/ui/civil-id-input";
import { PhonesField } from "@/components/domain/phones-field";
import { tenantSchema, type TenantInput } from "@/lib/schemas/master";
import { findTenantByCivilId, saveTenant } from "@/server/actions/master";
import { useAction, useFieldError } from "@/hooks/use-action";

const BLANK: TenantInput = {
  fullName: "",
  civilId: "",
  nationality: "",
  phones: [""],
  email: "",
  employer: "",
  emergencyContact: "",
  notes: "",
};

/** Tenant create/edit. `onSaved` receives the tenant (used by the contract wizard to create inline). */
export function TenantFormSheet({
  open,
  onOpenChange,
  tenant,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tenant?: (TenantInput & { id: string }) | null;
  onSaved?: (t: { id: string; full_name: string }) => void;
}) {
  const t = useTranslations("tenants");
  const tc = useTranslations("common.actions");
  const tErr = useTranslations("errors.field");
  const fe = useFieldError();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [dup, setDup] = useState<{ id: string; full_name: string } | null>(null);
  const form = useForm<TenantInput>({
    resolver: zodResolver(tenantSchema),
    mode: "onBlur",
    defaultValues: BLANK,
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = form;
  useEffect(() => {
    if (open) {
      form.reset(
        tenant ? { ...tenant, phones: tenant.phones?.length ? tenant.phones : [""] } : BLANK,
      );
      setDup(null);
    }
  }, [open, tenant, form]);
  const cid = watch("civilId");
  const submit = handleSubmit((v) =>
    exec(() => saveTenant(tenant?.id ?? null, { ...v, phones: (v.phones ?? []).filter(Boolean) }), {
      success: t("saved"),
      onSuccess: (row) => {
        onOpenChange(false);
        onSaved?.(row);
        router.refresh();
      },
    }),
  );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={tenant ? t("edit") : t("new")}
      footer={
        <Button block size="lg" onClick={submit} loading={pending}>
          {tc("save")}
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("fields.fullName")} htmlFor="t-name" error={fe(errors.fullName?.message)}>
          <Input
            id="t-name"
            autoFocus
            autoComplete="off"
            {...register("fullName")}
            aria-invalid={!!errors.fullName}
          />
        </Field>
        <Field
          label={t("fields.civilId")}
          htmlFor="t-cid"
          error={fe(errors.civilId?.message)}
          warning={civilIdStatus(cid) === "checksum" ? tErr("civilIdChecksum") : undefined}
          hint={
            dup ? (
              <Link className="text-link" href={`/tenants/${dup.id}`}>
                {t("duplicateCivilId", { name: dup.full_name })}
              </Link>
            ) : undefined
          }
        >
          <CivilIdInput
            id="t-cid"
            {...register("civilId", {
              onBlur: async (e) => {
                const v = String(e.target.value ?? "");
                if (v.replace(/\D/g, "").length === 12) {
                  const found = await findTenantByCivilId(v);
                  setDup(found && found.id !== tenant?.id ? found : null);
                }
              },
            })}
          />
        </Field>
        <Controller
          control={control}
          name="phones"
          render={({ field }) => (
            <PhonesField
              label={t("fields.phones")}
              value={field.value ?? []}
              onChange={field.onChange}
              error={fe(errors.phones?.message ?? errors.phones?.root?.message)}
              addLabel={t("fields.addPhone")}
              idPrefix="t-phone"
            />
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.nationality")} htmlFor="t-nat">
            <Input id="t-nat" {...register("nationality")} />
          </Field>
          <Field label={t("fields.email")} htmlFor="t-email" error={fe(errors.email?.message)}>
            <Input id="t-email" type="email" dir="ltr" inputMode="email" {...register("email")} />
          </Field>
          <Field label={t("fields.employer")} htmlFor="t-emp">
            <Input id="t-emp" {...register("employer")} />
          </Field>
          <Field label={t("fields.emergency")} htmlFor="t-emg">
            <Input id="t-emg" {...register("emergencyContact")} />
          </Field>
        </div>
        <Field label={t("fields.notes")} htmlFor="t-notes">
          <Textarea id="t-notes" {...register("notes")} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
