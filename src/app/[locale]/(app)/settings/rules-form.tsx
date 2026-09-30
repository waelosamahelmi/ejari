"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { SegmentedControl } from "@/components/ui/segmented";
import { MoneyInput } from "@/components/ui/money-input";
import { Stepper } from "@/components/ui/stepper";
import { useAction } from "@/hooks/use-action";
import { saveOrgSettings } from "@/server/actions/settings";
import type { OrgSettings } from "@/lib/auth";

export function RulesForm({ mode, title, settings }: { mode: "numbering" | "billing" | "reminder"; title: string; settings: OrgSettings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common.actions");
  const tu = useTranslations("ui");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [s, setS] = useState(settings);
  const save = (patch: Parameters<typeof saveOrgSettings>[0]) => exec(() => saveOrgSettings(patch), { success: t("org.saved"), onSuccess: () => router.refresh() });
  const year = new Date().getFullYear();
  return (
    <SettingsShell title={title}>
      {mode === "numbering" && (
        <Card className="space-y-4 p-5">
          {(["contractResidential", "contractInvestment", "receipt", "voucher"] as const).map((k) => (
            <Field key={k} label={t(`numbering.${k}`)} htmlFor={`n-${k}`} hint={t("numbering.example", { example: `${s.numbering[k]}-${year}-${k.startsWith("contract") ? "0001" : "00001"}` })}>
              <Input id={`n-${k}`} dir="ltr" maxLength={4} className="num uppercase" value={s.numbering[k]} onChange={(e) => setS({ ...s, numbering: { ...s.numbering, [k]: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } })} />
            </Field>
          ))}
          <Button loading={pending} onClick={() => save({ numbering: s.numbering })}>{tc("save")}</Button>
        </Card>
      )}
      {mode === "billing" && (
        <Card className="space-y-5 p-5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-[15px]">{t("billing.proration")}</span>
            <Toggle checked={s.proration} ariaLabel={t("billing.proration")} onCheckedChange={(v) => setS({ ...s, proration: v })} />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-[15px]">{t("billing.dueDay")}</span>
            <Stepper value={s.dueDay} onChange={(n) => setS({ ...s, dueDay: n })} min={1} max={28} labels={{ decrement: tu("decrement"), increment: tu("increment") }} />
          </div>
          <div className="flex items-center justify-between text-[15px]">
            <span>{t("billing.allocation")}</span>
            <span className="text-label-2">{t("billing.fifo")}</span>
          </div>
          <Field label={t("billing.receiptPolicy")}>
            <SegmentedControl options={[{ value: "warn", label: t("billing.warn") }, { value: "block", label: t("billing.block") }]} value={s.receiptDuplicatePolicy} onChange={(v) => setS({ ...s, receiptDuplicatePolicy: v as "warn" | "block" })} />
          </Field>
          <Field label={t("billing.threshold")} htmlFor="b-th"><MoneyInput id="b-th" value={s.voucherThresholdFils} onChange={(f) => setS({ ...s, voucherThresholdFils: f ?? 0 })} showWords={false} /></Field>
          <Field label={t("billing.lateDays")} htmlFor="b-late">
            <Input id="b-late" dir="ltr" className="num" value={s.lateReminderDays.join(", ")} onChange={(e) => setS({ ...s, lateReminderDays: e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0 && n < 366).slice(0, 8) })} />
          </Field>
          <Button loading={pending} onClick={() => save({ proration: s.proration, dueDay: s.dueDay, receiptDuplicatePolicy: s.receiptDuplicatePolicy, voucherThresholdFils: s.voucherThresholdFils, lateReminderDays: s.lateReminderDays })}>{tc("save")}</Button>
        </Card>
      )}
      {mode === "reminder" && (
        <Card className="space-y-4 p-5">
          <p className="text-label-2 text-[13px]" dir="ltr">{t("reminder.vars", { vars: "{{tenant_name}} {{amount}} {{months}} {{unit}} {{property}} {{org_name}}" })}</p>
          <Field label={t("reminder.ar")} htmlFor="r-ar"><Textarea id="r-ar" rows={6} value={s.reminderTemplateAr} onChange={(e) => setS({ ...s, reminderTemplateAr: e.target.value })} /></Field>
          <Field label={t("reminder.en")} htmlFor="r-en"><Textarea id="r-en" rows={6} dir="ltr" value={s.reminderTemplateEn} onChange={(e) => setS({ ...s, reminderTemplateEn: e.target.value })} /></Field>
          <Button loading={pending} onClick={() => save({ reminderTemplateAr: s.reminderTemplateAr, reminderTemplateEn: s.reminderTemplateEn })}>{tc("save")}</Button>
        </Card>
      )}
    </SettingsShell>
  );
}
