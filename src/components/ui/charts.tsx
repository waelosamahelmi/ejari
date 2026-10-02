"use client";
import { useReducedMotion } from "@/hooks/use-media";
import { useEffect, useState, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Progress ring (Activity-style). value 0..1. */
export function ProgressRing({
  value,
  size = 160,
  stroke = 16,
  color = "var(--brand-ink)",
  track = "var(--bg-inset)",
  children,
  className,
  label,
  celebrate,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
  label?: string;
  celebrate?: boolean;
}) {
  const reduced = useReducedMotion();
  // Start empty, then fill: the CSS transition draws the ring on first render.
  const mounted = useMounted();
  // One light tap when the ring completes (100% collected), alongside the sand shimmer.
  useEffect(() => {
    if (celebrate) haptic([12, 60, 12]);
  }, [celebrate]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 rtl:scale-y-[-1]"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: mounted || reduced ? c * (1 - v) : c }}
          className="transition-[stroke-dashoffset] duration-1000 ease-[var(--ease-spring)] motion-reduce:transition-none"
        />
        {celebrate && !reduced && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--brand-sand)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.12} ${c}`}
            style={{ ["--ring-c" as string]: `${c}px` }}
            className="ring-shimmer"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}

/** A bar segment that grows from 0 to its size on first paint (CSS transition, spring easing). */
function Grow({
  axis,
  to,
  className,
  color,
}: {
  axis: "width" | "height";
  to: string;
  className?: string;
  color: string;
}) {
  const mounted = useMounted();
  return (
    <div
      className={cn(
        "transition-[width,height] duration-700 ease-[var(--ease-spring)] motion-reduce:transition-none",
        className,
      )}
      style={{ background: color, [axis]: mounted ? to : 0 }}
    />
  );
}

/** Horizontal capacity bar like iOS storage. segments sum ≤ 1. */
export function Meter({
  segments,
  className,
  height = 10,
  label,
}: {
  segments: { value: number; color: string; label?: string }[];
  className?: string;
  height?: number;
  label?: string;
}) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("bg-inset flex w-full overflow-hidden rounded-full", className)}
      style={{ height }}
    >
      {segments.map((s, i) => (
        <Grow
          key={i}
          axis="width"
          to={`${Math.max(0, Math.min(1, s.value)) * 100}%`}
          className="h-full first:rounded-s-full"
          color={s.color}
        />
      ))}
    </div>
  );
}

/** Tiny sparkline; time flows toward the reading end (right→left in RTL). */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  color = "var(--brand-gulf)",
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map(
    (d, i) =>
      [(i / (data.length - 1)) * width, height - 3 - ((d - min) / span) * (height - 6)] as const,
  );
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("rtl:-scale-x-100", className)}
      aria-hidden
    >
      <path d={`${path}L${width} ${height}L0 ${height}Z`} fill={color} opacity={0.12} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Mini bars (aging buckets etc). */
export function BarMini({
  items,
  className,
  height = 56,
}: {
  items: { value: number; color: string; label: string; display?: string }[];
  className?: string;
  height?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={cn("flex items-end gap-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className="bg-inset relative w-full overflow-hidden rounded-[6px]"
            style={{ height }}
          >
            <Grow
              axis="height"
              to={`${(it.value / max) * 100}%`}
              className="absolute inset-x-0 bottom-0 rounded-[6px]"
              color={it.color}
            />
          </div>
          <span className="text-label-2 text-[11px] leading-none whitespace-nowrap">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Donut chart for small compositions. */
export function Donut({
  segments,
  size = 96,
  stroke = 14,
  children,
  label,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90 rtl:scale-y-[-1]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-inset)"
          strokeWidth={stroke}
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - (segments.length > 1 && len > 2 ? 2 : 0))} ${c}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Heatmap cell grid (rows × columns) with status classes supplied by caller. */
export function Heatmap<T>({
  rows,
  columns,
  cell,
  rowLabel,
  columnLabel,
  className,
}: {
  rows: T[];
  columns: string[];
  cell: (row: T, col: number) => ReactNode;
  rowLabel: (row: T) => ReactNode;
  columnLabel: (col: string, i: number) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th />
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className="text-label-2 px-0.5 pb-1 text-center text-[11px] font-medium"
              >
                {columnLabel(c, i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <th
                scope="row"
                className="text-label-2 max-w-28 truncate pe-2 text-start text-[12px] font-medium"
              >
                {rowLabel(r)}
              </th>
              {columns.map((_, ci) => (
                <td key={ci} className="p-0">
                  {cell(r, ci)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
