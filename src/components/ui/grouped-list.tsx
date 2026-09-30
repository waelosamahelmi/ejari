import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function GroupedList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-7", className)}>{children}</div>;
}

export function GroupedSection({
  header,
  footer,
  children,
  className,
  inset = true,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <section className={className}>
      {header && <h3 className="text-label-2 px-5 pb-2 text-[13px] font-medium uppercase tracking-wide">{header}</h3>}
      <div className={cn("bg-paper overflow-hidden", inset ? "rounded-[20px] shadow-[var(--sh-card)]" : "")}>
        <div className="divide-separator divide-y-[0.5px]">{children}</div>
      </div>
      {footer && <p className="text-label-2 px-5 pt-2 text-[13px] leading-5">{footer}</p>}
    </section>
  );
}

export interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
  destructive?: boolean;
  as?: "div" | "button" | "a" | "label";
  children?: ReactNode;
  LinkComponent?: React.ElementType;
}

/** iOS list row: leading icon tile, title/subtitle, trailing value, mirrored chevron. */
export function ListRow({ leading, title, subtitle, trailing, chevron, onClick, href, className, destructive, LinkComponent, children }: ListRowProps) {
  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[16px] leading-6", destructive ? "text-red-text" : "text-label")}>{title}</div>
        {subtitle && <div className="text-label-2 truncate text-[13px] leading-5">{subtitle}</div>}
        {children}
      </div>
      {trailing && <div className="text-label-2 flex shrink-0 items-center gap-2 text-[15px]">{trailing}</div>}
      {chevron && <ChevronRight className="text-label-3 flip-rtl size-[18px] shrink-0" aria-hidden />}
    </>
  );
  const base = cn(
    "flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-start",
    (onClick || href) && "hover:bg-paper-2 active:bg-inset transition-colors",
    className,
  );
  if (href) {
    const L = LinkComponent ?? "a";
    return (
      <L href={href} className={base}>
        {content}
      </L>
    );
  }
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    );
  return <div className={base}>{content}</div>;
}
