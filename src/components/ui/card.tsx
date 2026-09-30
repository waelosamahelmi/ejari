import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h3 className="truncate text-[17px] leading-6 font-semibold">{title}</h3>
          {subtitle && <p className="text-label-2 truncate text-[13px] leading-5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Section header: 20px semibold title + trailing "View all" (§21.1.13). */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-1 pb-3", className)}>
      <h2 className="text-[20px] leading-7 font-semibold">{title}</h2>
      {action && <div className="text-link text-[15px] font-medium">{action}</div>}
    </div>
  );
}
