"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { markTourDone } from "@/server/actions/preferences";
import { TOUR_STEPS, type TourPlacement } from "./tour-steps";

const CARD_W = 340;
const GAP = 14;

type Rect = { top: number; left: number; width: number; height: number };

function findVisible(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function position(rect: Rect | null, placement: TourPlacement | undefined, cardH: number) {
  if (!rect) return { centered: true, top: 0, left: 0 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rtl = document.documentElement.dir === "rtl";
  const prefer =
    placement === "auto" || !placement ? (rect.top > vh / 2 ? "top" : "bottom") : placement;
  let top = rect.top + rect.height + GAP;
  let left = rect.left + rect.width / 2 - CARD_W / 2;
  if (prefer === "top") top = rect.top - cardH - GAP;
  if (prefer === "start") {
    top = rect.top;
    left = rtl ? rect.left - CARD_W - GAP : rect.left + rect.width + GAP;
  }
  if (prefer === "end") {
    top = rect.top;
    left = rtl ? rect.left + rect.width + GAP : rect.left - CARD_W - GAP;
  }
  left = Math.max(14, Math.min(vw - CARD_W - 14, left));
  top = Math.max(14, Math.min(vh - cardH - 14, top));
  return { centered: false, top, left };
}

/**
 * Product tour (§ launch readiness): spotlight overlay with a route-aware card. Opens with
 * `?tour=1` anywhere in the app, survives navigation (mounted in the shell), and records
 * completion so it never auto-starts twice.
 */
export function GuidedTour() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get("tour") === "1";
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [cardH, setCardH] = useState(190);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index];

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setIndex(0);
      setRect(null);
    }
  }, [open]);

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("tour");
    const q = next.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`);
    void markTourDone();
  }, [params, pathname, router]);

  // Navigate to the step's route when needed (keeping the tour flag so it stays open).
  useEffect(() => {
    if (open && step?.route && pathname !== step.route) {
      router.push(`${step.route}?tour=1`);
    }
  }, [open, step, pathname, router]);

  // Find and measure the target (poll briefly right after a navigation).
  useEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const measure = (el: HTMLElement) => {
      if (cancelled) return;
      setRect(rectOf(el));
      setCardH(cardRef.current?.offsetHeight ?? 190);
    };
    const find = (tries: number) => {
      if (cancelled) return;
      const el = step.target ? findVisible(step.target) : null;
      if (el) {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        timer = setTimeout(() => measure(el), 380);
      } else if (tries < 10) {
        timer = setTimeout(() => find(tries + 1), 220);
      } else {
        setRect(null);
      }
    };
    if (!step.target) setRect(null);
    else find(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, index, pathname, step]);

  // Re-measure on resize/scroll so the spotlight tracks the element.
  useEffect(() => {
    if (!open || !step?.target) return;
    const update = () => {
      const el = findVisible(step.target!);
      if (el) setRect(rectOf(el));
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, index, rect]);

  useEffect(() => {
    if (!open) return;
    const rtl = document.documentElement.dir === "rtl";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      const forward = rtl ? "ArrowLeft" : "ArrowRight";
      const backward = rtl ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) setIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
      if (e.key === backward) setIndex((i) => Math.max(0, i - 1));
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON")
        setIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!mounted || !open || !step) return null;
  const last = index === TOUR_STEPS.length - 1;
  const pos = position(rect, step.placement, cardH);
  const title = t(`tour.${step.titleKey}` as "tour.steps.ring.title");
  const body = t(`tour.${step.bodyKey}` as "tour.steps.ring.body");

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0" />
      {rect && !pos.centered ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[20px] transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(14,15,18,.55)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(14,15,18,.55)]" />
      )}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-paper fixed rounded-[24px] p-5 shadow-[var(--sh-float)] outline-none"
        style={
          pos.centered
            ? { left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: `min(${CARD_W}px, calc(100vw - 28px))` }
            : { left: pos.left, top: pos.top, width: `min(${CARD_W}px, calc(100vw - 28px))` }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[18px] leading-snug font-semibold">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("tour.close")}
            className="text-label-3 hover:text-label -me-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-label-2 mt-1.5 text-[14px] leading-6">{body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-label-2 num text-[12px]">
            {t("tour.stepOf", { n: index + 1, total: TOUR_STEPS.length })}
          </span>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="plain" size="sm" onClick={() => setIndex((i) => i - 1)}>
                {t("tour.back")}
              </Button>
            )}
            <Button variant="plain" size="sm" onClick={close}>
              {t("tour.skip")}
            </Button>
            {last ? (
              <Button size="sm" onClick={close}>
                {t("tour.done")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                {t("tour.next")}
                <ArrowLeft className="size-4 ltr:hidden" />
                <ArrowRight className="size-4 rtl:hidden" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
