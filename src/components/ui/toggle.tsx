"use client";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** iOS switch; "on" is Ink (§18.3). */
export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  ariaLabel,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40",
        "data-[state=checked]:bg-ink data-[state=unchecked]:bg-[#E3E3E8] dark:data-[state=unchecked]:bg-[#39393D]",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_3px_1px_rgba(0,0,0,.06)] transition-transform duration-200 ease-[var(--ease-spring)] dark:data-[state=checked]:bg-[#0E0F12]",
          "translate-x-[2px] data-[state=checked]:translate-x-[22px] rtl:-translate-x-[2px] rtl:data-[state=checked]:-translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
