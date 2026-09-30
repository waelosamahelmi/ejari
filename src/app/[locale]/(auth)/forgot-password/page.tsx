"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { AuthCard } from "@/components/domain/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { sendPasswordReset } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgot");
  const tErr = useTranslations("errors");
  const locale = useLocale() as "ar" | "en";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await sendPasswordReset({ email, locale });
            if (r.ok) setSent(true);
            else
              setError(
                tErr(r.error === "validation" ? "field.invalidEmail" : (r.error as "generic")),
              );
          });
        }}
      >
        <Field label={t("title")} htmlFor="email" error={error}>
          <Input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {sent && (
          <p
            role="status"
            className="bg-green/12 text-green-text rounded-[14px] px-4 py-3 text-[14px]"
          >
            {t("sent")}
          </p>
        )}
        <Button type="submit" size="lg" block loading={pending} disabled={!email}>
          {t("submit")}
        </Button>
        <Link
          href="/login"
          className="text-link flex items-center justify-center gap-1 py-2 text-[15px] font-medium"
        >
          <ChevronRight className="size-4 rotate-180 rtl:rotate-0" />
          {t("back")}
        </Link>
      </form>
    </AuthCard>
  );
}
