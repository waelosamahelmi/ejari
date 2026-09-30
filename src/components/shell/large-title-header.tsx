"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { HeaderUtilities } from "./app-shell";

/**
 * Large title that collapses into an inline bar title on scroll (sticky, material).
 * Trailing actions stay visible; optional content (search / filters) sits under the title.
 */
export function LargeTitleHeader({
  title,
  subtitle,
  actions,
  back,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
  className?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e!.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-30 -mx-4 flex h-[calc(56px+var(--safe-top))] items-end px-4 pt-[var(--safe-top)] transition-[background,box-shadow] duration-200 lg:-mx-8 lg:h-14 lg:px-8 lg:pt-0 print:hidden",
          collapsed ? "material-bar shadow-[0_0.5px_0_var(--separator)]" : "bg-transparent",
        )}
      >
        <div className="flex h-14 w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1">
            {back && (
              <Link
                href={back.href}
                className="text-link -ms-2 flex h-10 items-center gap-0.5 rounded-full pe-2 text-[16px]"
                aria-label={back.label}
              >
                <ChevronRight className="size-6 rotate-180 rtl:rotate-0" />
                <span className="hidden max-w-40 truncate sm:inline">{back.label}</span>
              </Link>
            )}
            <span
              className={cn(
                "truncate text-[17px] font-semibold transition-opacity duration-200",
                collapsed ? "opacity-100" : "opacity-0",
              )}
              aria-hidden={!collapsed}
            >
              {title}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <HeaderUtilities />
          </div>
        </div>
      </div>
      <header className={cn("pt-1 pb-4", className)}>
        <h1 className="text-[34px] leading-[41px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-label-2 mt-0.5 text-[15px]">{subtitle}</p>}
        <div ref={sentinel} className="h-px" />
        {children && <div className="mt-3">{children}</div>}
      </header>
    </>
  );
}
