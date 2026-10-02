"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "./input";

/** Password field with a show/hide toggle (RTL-safe, 44px target). */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = "new-password",
  invalid,
  disabled,
  autoFocus,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: "new-password" | "current-password";
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
}) {
  const t = useTranslations("ui");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        dir="ltr"
        autoComplete={autoComplete}
        required
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className="pe-12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <button
        type="button"
        aria-label={show ? t("hidePassword") : t("showPassword")}
        aria-pressed={show}
        onClick={() => setShow((v) => !v)}
        className="text-label-2 hover:text-label absolute end-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}
