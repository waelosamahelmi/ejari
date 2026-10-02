"use client";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** desktop panel width */
  size?: "md" | "lg" | "xl";
  /** hide the visual title (still announced) */
  hideTitle?: boolean;
  className?: string;
}

const load = () => import("./sheet-impl").then((m) => m.SheetImpl);
const SheetImpl = dynamic(load, { ssr: false });

/**
 * Sheet: bottom drawer (vaul) on mobile, side panel from the END edge on desktop.
 * The implementation (vaul + Radix dialog) is code-split: it's prefetched when the
 * page is idle and mounted on first open, so it never weighs on first load.
 */
export function Sheet(props: SheetProps) {
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true);
  useEffect(() => prefetchWhenIdle(load), []);
  return used ? <SheetImpl {...props} /> : null;
}

const prefetched = new Set<() => Promise<unknown>>();
/** Warms a code-split module once, when the main thread is idle. */
export function prefetchWhenIdle(fn: () => Promise<unknown>) {
  if (prefetched.has(fn) || typeof window === "undefined") return;
  prefetched.add(fn);
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  (w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500)))(
    () => void fn().catch(() => prefetched.delete(fn)),
  );
}
