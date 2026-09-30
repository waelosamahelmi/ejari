"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { inputBase } from "./input";

/** Kuwaiti phone input with a fixed +965 prefix (8 digits). */
export const PhoneInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PhoneInput(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative" dir="ltr">
      <span className="text-label-2 num pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[16px]">+965</span>
      <input ref={ref} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={12} className={cn(inputBase, "num h-[52px] ps-[4.25rem]", className)} {...props} />
    </div>
  );
});
