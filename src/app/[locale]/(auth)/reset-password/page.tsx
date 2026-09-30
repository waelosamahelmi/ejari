"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { AuthCard } from "@/components/domain/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { updatePassword } from "@/server/actions/auth";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.reset");
  const tErr = useTranslations("errors");
  const locale = useLocale();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw !== confirm) return setError(t("mismatch"));
          if (pw.length < 8) return setError(tErr("field.minPassword"));
          start(async () => {
            const r = await updatePassword({ password: pw });
            if (!r.ok) return setError(tErr(r.error as "generic"));
            toast.success(t("done"));
            window.location.href = `/${locale}`;
          });
        }}
      >
        <Field label={t("password")} htmlFor="pw">
          <Input
            id="pw"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </Field>
        <Field label={t("confirm")} htmlFor="pw2" error={error}>
          <Input
            id="pw2"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" block loading={pending}>
          {t("submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
