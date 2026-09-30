"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  className,
  format,
  labels,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  format?: (v: number) => string;
  labels: { decrement: string; increment: string };
}) {
  return (
    <div className={cn("bg-inset inline-flex h-11 items-center rounded-full p-1", className)}>
      <button
        type="button"
        aria-label={labels.decrement}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="press hover:bg-paper flex size-9 items-center justify-center rounded-full disabled:opacity-30"
      >
        <Minus className="size-4" />
      </button>
      <span className="num min-w-10 text-center text-[16px] font-semibold" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        aria-label={labels.increment}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="press hover:bg-paper flex size-9 items-center justify-center rounded-full disabled:opacity-30"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
