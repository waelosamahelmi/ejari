"use client";
import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Histogram range slider (§21.1.9): bars show the distribution, bars inside the
 * selected range are ink, others light gray; dark value bubbles above thumbs.
 * Values are numbers (e.g. fils); `format` renders the bubbles.
 */
export function HistogramRangeSlider({
  values,
  min,
  max,
  value,
  onChange,
  format,
  bins = 36,
  step = 1,
  labels,
  className,
}: {
  values: number[];
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format: (n: number) => string;
  bins?: number;
  step?: number;
  labels: { min: string; max: string };
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const span = Math.max(1, max - min);
  const counts = useMemo(() => {
    const c = Array.from({ length: bins }, () => 0);
    for (const v of values) {
      const i = Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / span) * bins)));
      c[i]! += 1;
    }
    return c;
  }, [values, min, span, bins]);
  const peak = Math.max(1, ...counts);
  const pct = (v: number) => ((v - min) / span) * 100;
  const [lo, hi] = value;

  const setFromPointer = (clientX: number, which: 0 | 1) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    let ratio = (clientX - r.left) / r.width;
    if (rtl) ratio = 1 - ratio;
    let v = min + Math.round((Math.max(0, Math.min(1, ratio)) * span) / step) * step;
    if (which === 0) v = Math.min(v, hi);
    else v = Math.max(v, lo);
    onChange(which === 0 ? [v, hi] : [lo, v]);
  };

  const thumb = (which: 0 | 1) => {
    const v = which === 0 ? lo : hi;
    return (
      <div className="absolute top-1/2 -translate-y-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: `${pct(v)}%` }}>
        <span className="bg-ink text-on-ink num pointer-events-none absolute bottom-7 start-1/2 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ltr:-translate-x-1/2 rtl:translate-x-1/2">
          {format(v)}
        </span>
        <button
          type="button"
          role="slider"
          aria-label={which === 0 ? labels.min : labels.max}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={v}
          aria-valuetext={format(v)}
          className="bg-paper ring-ink block size-6 touch-none rounded-full shadow-[0_2px_6px_rgba(0,0,0,.2)] ring-2"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) setFromPointer(e.clientX, which);
          }}
          onKeyDown={(e) => {
            const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
            const inc = e.key === "ArrowUp" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
            const dec = e.key === "ArrowDown" || e.key === (rtl ? "ArrowRight" : "ArrowLeft");
            if (!inc && !dec) return;
            e.preventDefault();
            const d = (inc ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            if (which === 0) onChange([Math.max(min, Math.min(hi, lo + d)), hi]);
            else onChange([lo, Math.min(max, Math.max(lo, hi + d))]);
          }}
        />
      </div>
    );
  };

  return (
    <div className={cn("pt-10", className)}>
      <div className="flex h-16 items-end gap-[2px]" aria-hidden>
        {counts.map((c, i) => {
          const binStart = min + (i / bins) * span;
          const binEnd = min + ((i + 1) / bins) * span;
          const inside = binEnd >= lo && binStart <= hi;
          return (
            <div
              key={i}
              className={cn("flex-1 rounded-t-[2px] transition-colors", inside ? "bg-ink" : "bg-label-3/50")}
              style={{ height: `${c === 0 ? 4 : 12 + (c / peak) * 88}%` }}
            />
          );
        })}
      </div>
      <div ref={track} className="bg-inset relative mt-2 h-1.5 rounded-full" onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        let ratio = (e.clientX - r.left) / r.width;
        if (rtl) ratio = 1 - ratio;
        const v = min + ratio * span;
        setFromPointer(e.clientX, Math.abs(v - lo) <= Math.abs(v - hi) ? 0 : 1);
      }}>
        <div className="bg-ink absolute inset-y-0 rounded-full" style={{ insetInlineStart: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        {thumb(0)}
        {thumb(1)}
      </div>
      <div className="text-label-2 num mt-3 flex justify-between text-[12px]">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
