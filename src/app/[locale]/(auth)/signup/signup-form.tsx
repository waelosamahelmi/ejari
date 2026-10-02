"use client";
import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Link } from "@/i18n/navigation";
import { passwordProblem } from "@/domain/account";
import { resendConfirmation, signUp } from "@/server/actions/auth";

type FieldErrors = { name?: string; email?: string; password?: string; terms?: string };

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tErr = useTranslations("errors");
  const locale = useLocale() as "ar" | "en";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [verify, setVerify] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pendingResend, startResend] = useTransition();

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (name.trim().length < 2) e.name = "required";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "required";
    const problem = passwordProblem(password);
    if (problem) e.password = problem === "short" ? "password_short" : "password_weak";
    if (password !== confirm) e.password = "mismatch";
    if (!terms) e.terms = "termsRequired";
    return e;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    start(async () => {
      const r = await signUp({ name: name.trim(), email: email.trim(), password, locale, terms: true });
      if (!r.ok) {
        if (r.error === "password_short" || r.error === "password_weak")
          return setErrors({ password: r.error });
        if (r.error === "email_taken") return setErrors({ email: "email_taken" });
        return setAlert(tErr(r.error as "generic"));
      }
      if (r.data.next === "setup") {
        window.location.href = `/${locale}/setup`;
        return;
      }
      setVerify(true);
    });
  };

  const resend = () => {
    setInfo(null);
    startResend(async () => {
      const r = await resendConfirmation({ email: email.trim(), locale });
      if (r.ok) setInfo(t("resent"));
      else setAlert(tErr(r.error as "generic"));
    });
  };

  if (verify) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-green/12 text-green-text mx-auto flex size-14 items-center justify-center rounded-full">
          <MailCheck className="size-7" />
        </div>
        <h2 className="text-[24px] leading-tight font-semibold">{t("verifyTitle")}</h2>
        <p className="text-label-2 text-[15px] leading-6">
          {t("verifyText", { email: email.trim() })}
        </p>
        {info && <p className="text-green-text text-[14px]">{info}</p>}
        {alert && (
          <p role="alert" className="bg-red/10 text-red-text rounded-[14px] px-4 py-3 text-[14px]">
            {alert}
          </p>
        )}
        <Button variant="secondary" size="lg" block loading={pendingResend} onClick={resend}>
          {t("resend")}
        </Button>
        <Link href="/login" className="text-link block text-[14px] font-medium">
          {t("signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-[28px] leading-tight font-semibold">{t("formTitle")}</h2>
        <p className="text-label-2 mt-1 text-[15px]">{t("formSubtitle")}</p>
      </div>
      <Field label={t("name")} htmlFor="su-name" error={errors.name ? tErr("field.required") : undefined}>
        <Input
          id="su-name"
          autoComplete="name"
          autoFocus
          value={name}
          aria-invalid={!!errors.name || undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name && name.trim().length < 2 && setErrors((p) => ({ ...p, name: "required" }))}
        />
      </Field>
      <Field
        label={t("email")}
        htmlFor="su-email"
        error={
          errors.email === "email_taken"
            ? tErr("email_taken")
            : errors.email
              ? tErr("field.required")
              : undefined
        }
      >
        <Input
          id="su-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={email}
          aria-invalid={!!errors.email || undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field
        label={t("password")}
        htmlFor="su-password"
        error={
          errors.password === "mismatch"
            ? t("mismatch")
            : errors.password
              ? tErr(errors.password as "password_short")
              : undefined
        }
      >
        <PasswordInput
          id="su-password"
          value={password}
          invalid={!!errors.password}
          onChange={setPassword}
        />
      </Field>
      <Field label={t("confirm")} htmlFor="su-confirm">
        <PasswordInput id="su-confirm" value={confirm} onChange={setConfirm} />
      </Field>
      <label className="flex items-start gap-3 text-[14px] leading-6">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="accent-ink mt-1.5 size-4 shrink-0"
        />
        <span>
          {t("terms")}{" "}
          <Link href="/terms" target="_blank" className="text-link font-medium">
            {t("termsLink")}
          </Link>{" "}
          <Link href="/privacy" target="_blank" className="text-link font-medium">
            {t("privacyLink")}
          </Link>
        </span>
      </label>
      {errors.terms && <p className="text-red-text -mt-2 text-[13px]">{t("termsRequired")}</p>}
      {alert && (
        <p role="alert" className="bg-red/10 text-red-text rounded-[14px] px-4 py-3 text-[14px]">
          {alert}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending} disabled={!terms}>
        {t("submit")}
      </Button>
      <p className="text-label-2 text-center text-[14px]">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-link font-medium">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
