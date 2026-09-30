"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { validateCivilId } from "@/domain/validation";
import { inputBase } from "./input";

/** Civil ID input (12 digits). `onChecksum` reports whether the Kuwaiti checksum passes. */
export const CivilIdInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function CivilIdInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        inputMode="numeric"
        dir="ltr"
        maxLength={14}
        autoComplete="off"
        className={cn(inputBase, "num h-[52px] tracking-wider", className)}
        {...props}
      />
    );
  },
);

export function civilIdStatus(
  v: string | null | undefined,
): "empty" | "format" | "checksum" | "ok" {
  if (!v) return "empty";
  const r = validateCivilId(v);
  if (!r.formatValid) return "format";
  return r.checksumValid ? "ok" : "checksum";
}
