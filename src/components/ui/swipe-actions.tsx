"use client";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { useMediaQuery } from "@/hooks/use-media";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  tone?: "ink" | "green" | "red" | "gulf";
  href?: string;
  onAction?: () => void;
}

const TONE = { ink: "bg-ink text-on-ink", green: "bg-green text-white", red: "bg-red text-white", gulf: "bg-gulf text-white" };
const W = 76;

/**
 * iOS-style swipe actions (touch only): swipe toward the start edge to reveal
 * actions on the end edge — right-to-left in English, left-to-right in Arabic.
 * Pointer events + a CSS spring transition; vertical scrolling is left to the browser.
 */
export function SwipeActions({ actions, children, className }: { actions: SwipeAction[]; children: ReactNode; className?: string }) {
  const rtl = useLocale() === "ar";
  const touch = useMediaQuery("(pointer: coarse)");
  const width = actions.length * W;
  const openX = rtl ? width : -width;
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const blockClick = useRef(false);
  const g = useRef<{ x0: number; y0: number; base: number; axis: "x" | "y" | null; moved: boolean } | null>(null);

  if (!touch || actions.length === 0) return <div className={className}>{children}</div>;

  const clamp = (v: number) => (rtl ? Math.min(width * 1.08, Math.max(0, v)) : Math.max(-width * 1.08, Math.min(0, v)));
  const onDown = (e: PointerEvent) => {
    g.current = { x0: e.clientX, y0: e.clientY, base: x, axis: null, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.axis && Math.hypot(dx, dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (s.axis !== "x") return;
    s.moved = true;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setX(clamp(s.base + dx));
  };
  const onUp = () => {
    const s = g.current;
    g.current = null;
    setDragging(false);
    if (!s?.moved) return;
    const toward = rtl ? x : -x;
    const open = toward > width / 2;
    if (open && s.base === 0) haptic(8);
    setX(open ? openX : 0);
    // Swallow the click that follows a swipe.
    blockClick.current = true;
    window.setTimeout(() => (blockClick.current = false), 0);
  };
  return (
    <div className={cn("relative overflow-hidden rounded-[20px]", className)}>
      <div className="absolute inset-y-0 end-0 flex" style={{ width }}>
        {actions.map((a) => {
          const cls = cn("flex flex-1 flex-col items-center justify-center gap-1 text-[12px] font-medium", TONE[a.tone ?? "ink"]);
          const inner = (
            <>
              <span className="[&_svg]:size-5" aria-hidden>{a.icon}</span>
              {a.label}
            </>
          );
          return a.href ? (
            <a key={a.label} href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls} tabIndex={x === 0 ? -1 : 0} onClick={() => setX(0)}>
              {inner}
            </a>
          ) : (
            <button key={a.label} type="button" className={cls} tabIndex={x === 0 ? -1 : 0} onClick={() => { a.onAction?.(); setX(0); }}>
              {inner}
            </button>
          );
        })}
      </div>
      <div
        className={cn("relative", !dragging && "transition-transform duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none")}
        style={{ transform: `translateX(${x}px)`, touchAction: "pan-y" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          if (blockClick.current || x !== 0) {
            e.preventDefault();
            e.stopPropagation();
            setX(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
