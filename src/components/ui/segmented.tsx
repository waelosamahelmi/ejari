"use client";
import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * Segmented pill group: light gray track, white raised thumb that springs to
 * the selection (§9.3 SegmentedControl / §21.1.8 PillSegmented).
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ariaLabel,
  fill = true,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
  fill?: boolean;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "bg-inset relative inline-flex items-center rounded-full p-1",
        fill && "flex w-full",
        size === "sm" && "h-9",
        size === "md" && "h-11",
        size === "lg" && "h-[52px]",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const idx = options.findIndex((x) => x.value === value);
              const dirRtl = getComputedStyle(e.currentTarget).direction === "rtl";
              const nextKey = dirRtl ? "ArrowLeft" : "ArrowRight";
              const prevKey = dirRtl ? "ArrowRight" : "ArrowLeft";
              if (e.key === nextKey || e.key === prevKey) {
                e.preventDefault();
                const step = e.key === nextKey ? 1 : -1;
                const n = options[(idx + step + options.length) % options.length];
                if (n && !n.disabled) onChange(n.value);
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              "relative z-0 flex h-full min-w-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 font-medium whitespace-nowrap transition-colors disabled:opacity-40",
              size === "sm" ? "text-[13px]" : "text-[15px]",
              active ? "text-label" : "text-label-2 hover:text-label",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="bg-paper absolute inset-0 -z-10 rounded-full shadow-[0_1px_3px_rgba(16,24,40,.12),0_1px_1px_rgba(16,24,40,.04)] dark:bg-[#3a3a3c]"
              />
            )}
            {o.icon}
            <span className="num-inherit">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl as PillSegmented };
