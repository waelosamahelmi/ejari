"use client";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { CivilIdInput, civilIdStatus } from "@/components/ui/civil-id-input";
import { PhonesField } from "@/components/domain/phones-field";
import { ownerSchema, type OwnerInput } from "@/lib/schemas/master";
import { saveOwner } from "@/server/actions/master";
import { useAction, useFieldError } from "@/hooks/use-action";

export function OwnerFormSheet({ open, onOpenChange, owner, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; owner?: (OwnerInput & { id: string }) | null; onSaved?: (id: string) => void }) {
  const t = useTranslations("owners");
  const tc = useTranslations("common.actions");
  const tErr = useTranslations("errors.field");
  const fe = useFieldError();
  const router = useRouter();
  const { exec, pending } = useAction();
  const form = useForm<OwnerInput>({ resolver: zodResolver(ownerSchema), mode: "onBlur", defaultValues: { fullName: "", phones: [""], civilId: "", email: "", iban: "", bankName: "", address: "", notes: "" } });
  useEffect(() => {
    if (open) form.reset(owner ? { ...owner, phones: owner.phones?.length ? owner.phones : [""] } : { fullName: "", phones: [""], civilId: "", email: "", iban: "", bankName: "", address: "", notes: "" });
  }, [open, owner, form]);
  const { register, handleSubmit, control, formState: { errors }, watch } = form;
  const cid = watch("civilId");
  const submit = handleSubmit((v) =>
    exec(() => saveOwner(owner?.id ?? null, { ...v, phones: (v.phones ?? []).filter(Boolean) }), {
      success: t("saved"),
      onSuccess: (id) => {
        onOpenChange(false);
        onSaved?.(id);
        router.refresh();
      },
    }),
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={owner ? t("edit") : t("new")} footer={<Button block size="lg" onClick={submit} loading={pending}>{tc("save")}</Button>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("fields.fullName")} htmlFor="o-name" error={fe(errors.fullName?.message)}>
          <Input id="o-name" autoFocus {...register("fullName")} aria-invalid={!!errors.fullName} />
        </Field>
        <Field label={t("fields.civilId")} htmlFor="o-cid" error={fe(errors.civilId?.message)} warning={civilIdStatus(cid) === "checksum" ? tErr("civilIdChecksum") : undefined}>
          <CivilIdInput id="o-cid" {...register("civilId")} />
        </Field>
        <Controller control={control} name="phones" render={({ field }) => <PhonesField label={t("fields.phones")} value={field.value ?? []} onChange={field.onChange} error={fe(errors.phones?.message ?? errors.phones?.root?.message)} addLabel={tc("add")} idPrefix="o-phone" />} />
        <Field label={t("fields.email")} htmlFor="o-email" error={fe(errors.email?.message)}>
          <Input id="o-email" type="email" dir="ltr" inputMode="email" {...register("email")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.bankName")} htmlFor="o-bank"><Input id="o-bank" {...register("bankName")} /></Field>
          <Field label={t("fields.iban")} htmlFor="o-iban" error={fe(errors.iban?.message)}><Input id="o-iban" dir="ltr" className="num" {...register("iban")} placeholder="KW.." /></Field>
        </div>
        <Field label={t("fields.address")} htmlFor="o-addr"><Input id="o-addr" {...register("address")} /></Field>
        <Field label={t("fields.notes")} htmlFor="o-notes"><Textarea id="o-notes" {...register("notes")} /></Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
