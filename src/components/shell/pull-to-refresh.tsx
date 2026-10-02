"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMediaQuery } from "@/hooks/use-media";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;
const MAX = 110;

/**
 * Custom pull-to-refresh for the installed app (§19.1): the shell disables native
 * overscroll, so on touch devices a pull from the top re-fetches the page's server
 * data (router.refresh) with an iOS-style indicator. Plain CSS transitions (spring
 * easing token) keep it out of the animation library's bundle.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const t = useTranslations("common.actions");
  const router = useRouter();
  const touch = useMediaQuery("(pointer: coarse)");
  const [pending, start] = useTransition();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!touch) return;
    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (window.scrollY > 0 || target?.closest("[role=dialog],[data-vaul-drawer],[data-no-ptr]"))
        return;
      startY.current = e.touches[0]?.clientY ?? null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      setDragging(true);
      const eased = Math.min(MAX, dy * 0.5);
      setPull(eased);
      if (eased >= THRESHOLD && !armed.current) haptic(8);
      armed.current = eased >= THRESHOLD;
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (armed.current) {
        setPull(48);
        start(() => router.refresh());
      } else setPull(0);
      armed.current = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [touch, router]);

  // Collapse once the refreshed data has arrived.
  useEffect(() => {
    if (!pending && !dragging && startY.current === null) setPull((p) => (p === 48 ? 0 : p));
  }, [pending, dragging]);

  if (!touch) return <>{children}</>;
  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <>
      <div
        role="status"
        aria-label={pending ? t("reload") : undefined}
        style={{ height: pull, opacity: progress }}
        className={cn(
          "pointer-events-none flex items-end justify-center overflow-hidden",
          !dragging &&
            "transition-[height,opacity] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none",
        )}
      >
        <span
          style={{ transform: pending ? undefined : `rotate(${progress * 270}deg)` }}
          className={cn(
            "bg-paper mb-2 flex size-9 items-center justify-center rounded-full shadow-[var(--sh-card)]",
            pending && "motion-safe:animate-spin",
            progress >= 1 ? "text-ink" : "text-label-2",
          )}
        >
          <RefreshCw className="size-[18px]" aria-hidden />
        </span>
      </div>
      {children}
    </>
  );
}
