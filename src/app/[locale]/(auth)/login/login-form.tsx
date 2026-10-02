"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { sendMagicLink, signInWithPassword } from "@/server/actions/auth";

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const t = useTranslations("auth.login");
  const tErr = useTranslations("errors");
  const locale = useLocale() as "ar" | "en";
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? tErr("link") : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [magicPending, startMagic] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await signInWithPassword({ email, password });
      if (!r.ok) {
        setError(tErr(r.error === "validation" ? "invalid_credentials" : (r.error as "generic")));
        return;
      }
      const next = params.get("next");
      window.location.href =
        next && next.startsWith(`/${locale}/`)
          ? next
          : `/${locale}/${r.data.role === "owner" ? "owner" : "dashboard"}`;
    });
  };
  const magic = () => {
    setError(null);
    startMagic(async () => {
      const r = await sendMagicLink({ email, locale, next: params.get("next") ?? undefined });
      if (!r.ok) setError(tErr(r.error as "generic"));
      else setInfo(t("magicSent"));
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-[28px] leading-tight font-semibold">{t("headline")}</h2>
        <p className="text-label-2 mt-1 text-[15px]">{t("subtitle")}</p>
      </div>
      <Field label={t("email")} htmlFor="email">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field
        label={t("password")}
        htmlFor="password"
        trailing={
          <Link href="/forgot-password" className="text-link text-[13px] font-medium">
            {t("forgot")}
          </Link>
        }
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="bg-red/10 text-red-text rounded-[14px] px-4 py-3 text-[14px]">
          {error}
        </p>
      )}
      {info && (
        <p
          role="status"
          className="bg-green/12 text-green-text rounded-[14px] px-4 py-3 text-[14px]"
        >
          {info}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending} disabled={!email || !password}>
        {t("submit")}
      </Button>
      <div className="text-label-2 flex items-center gap-3 text-[13px]">
        <span className="bg-separator h-px flex-1" />
        {t("or")}
        <span className="bg-separator h-px flex-1" />
      </div>
      <Button
        variant="secondary"
        size="lg"
        block
        onClick={magic}
        loading={magicPending}
        disabled={!email}
      >
        <Mail />
        {t("magicLink")}
      </Button>
      {showDemo && (
        <div className="bg-inset/60 rounded-[16px] p-3 text-[13px]">
          <div className="text-label-2 mb-1.5 font-medium">{t("demo")}</div>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {["admin", "accountant", "collector", "owner"].map((r) => (
              <button
                key={r}
                type="button"
                className="bg-paper hover:bg-paper-2 rounded-full px-3 py-1 text-[12px] font-medium"
                onClick={() => {
                  setEmail(`${r}@demo.test`);
                  setPassword("Demo12345!");
                }}
              >
                {r}@demo.test
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
