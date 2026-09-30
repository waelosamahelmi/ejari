"use client";
import { forwardRef, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { fromFils, toFils } from "@/domain/money";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";
import { inputBase } from "./input";

function display(fils: number | null | undefined): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return "";
  return fromFils(fils);
}

/**
 * Fils-safe amount input: accepts Arabic/Western digits and separators,
 * normalizes to 3 decimals on blur, and shows the amount in words beneath.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number | null;
    onChange: (fils: number | null) => void;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    showWords?: boolean;
    className?: string;
    invalid?: boolean;
    autoFocus?: boolean;
    name?: string;
    onBlur?: () => void;
    size?: "md" | "lg";
  }
>(function MoneyInput(
  {
    value,
    onChange,
    id,
    placeholder = "0.000",
    disabled,
    showWords = true,
    className,
    invalid,
    autoFocus,
    name,
    onBlur,
    size = "md",
  },
  ref,
) {
  const locale = useLocale();
  const [text, setText] = useState(display(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(display(value));
  }, [value, focused]);

  let words = "";
  if (showWords && value !== null && value > 0) {
    try {
      words = locale === "ar" ? tafqeetKWD(value) : wordsEN(value);
    } catch {
      words = "";
    }
  }

  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          placeholder={placeholder}
          value={text}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            try {
              const f = v.trim() === "" ? null : toFils(v);
              onChange(f !== null && f >= 0 ? f : null);
            } catch {
              onChange(null);
            }
          }}
          onBlur={() => {
            setFocused(false);
            setText(display(value));
            onBlur?.();
          }}
          className={cn(
            inputBase,
            "num pe-16 text-end font-semibold",
            size === "lg" ? "h-16 text-[28px]" : "h-[52px] text-[18px]",
          )}
        />
        <span className="text-label-2 pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[15px]">
          {locale === "ar" ? "د.ك" : "KWD"}
        </span>
      </div>
      {showWords && (
        <p className="text-label-2 mt-1.5 min-h-5 px-1 text-[13px] leading-5" aria-live="polite">
          {words}
        </p>
      )}
    </div>
  );
});
