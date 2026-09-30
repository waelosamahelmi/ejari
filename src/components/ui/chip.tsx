"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Gavel } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PERIOD_STATUS_STYLE, UNIT_STATUS_STYLE } from "@/lib/status";
import type { ContractStatus, PeriodStatus, UnitStatus } from "@/domain/types";

export function Chip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-ink text-on-ink" : "bg-paper text-label ring-separator ring-1 hover:bg-paper-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Chip with a round icon on the leading side (§21.1.7). Active: Ink fill, icon circle inverted. */
export function IconChip({
  icon,
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "press inline-flex h-11 shrink-0 items-center gap-2 rounded-full ps-1 pe-4 text-[15px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-ink text-on-ink" : "bg-paper text-label shadow-[0_1px_2px_rgba(16,24,40,.05)]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full [&_svg]:size-[18px]",
          active ? "bg-on-ink text-ink" : "bg-inset text-label",
        )}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

/** Horizontal chip scroller that starts from the reading edge (right in RTL). */
export function ChipScroller({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 [&>*]:snap-start", className)}
    >
      {children}
    </div>
  );
}

export function Pill({ className, children, dot }: { className?: string; children: ReactNode; dot?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap", className)}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function PeriodStatusPill({ status, className }: { status: PeriodStatus; className?: string }) {
  const t = useTranslations("enums.periodStatus");
  const s = PERIOD_STATUS_STYLE[status];
  return (
    <Pill className={cn(s.bg, s.fg, className)} dot={status === "legal" ? undefined : s.dot}>
      {status === "legal" && <Gavel className="size-3" aria-hidden />}
      {t(status)}
    </Pill>
  );
}

export function UnitStatusPill({ status, className }: { status: UnitStatus; className?: string }) {
  const t = useTranslations("enums.unitStatus");
  const s = UNIT_STATUS_STYLE[status];
  return (
    <Pill className={cn(s.bg, s.fg, className)} dot={status === "legal" ? undefined : s.dot}>
      {status === "legal" && <Gavel className="size-3" aria-hidden />}
      {t(status)}
    </Pill>
  );
}

const CONTRACT_STATUS: Record<ContractStatus, string> = {
  draft: "bg-inset text-label-2",
  active: "bg-green/14 text-green-text",
  notice_given: "bg-orange/16 text-orange-text",
  ended: "bg-gray/16 text-gray-text",
  terminated: "bg-red/14 text-red-text",
  renewed: "bg-indigo/14 text-indigo-text",
};

export function ContractStatusPill({ status, className }: { status: ContractStatus; className?: string }) {
  const t = useTranslations("enums.contractStatus");
  return <Pill className={cn(CONTRACT_STATUS[status], className)}>{t(status)}</Pill>;
}
