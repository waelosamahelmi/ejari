"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AuthCard } from "@/components/domain/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createOrganization } from "@/server/actions/auth";

export default function NoOrgPage() {
  const t = useTranslations("auth.noOrg");
  const tErr = useTranslations("errors");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createOrganization({ name, nameEn });
            if (!r.ok) return setError(tErr(r.error as "generic"));
            window.location.href = `/${locale}/dashboard`;
          });
        }}
      >
        <Field label={t("name")} htmlFor="name">
          <Input id="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("nameEn")} htmlFor="nameEn" error={error}>
          <Input id="nameEn" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" block loading={pending} disabled={name.trim().length < 2}>{t("submit")}</Button>
      </form>
    </AuthCard>
  );
}
