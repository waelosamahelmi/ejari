import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Large soft illustration, title, one line, one primary action. */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
  compact,
}: {
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-14", className)}>
      {illustration && <div className={cn("text-label mb-5", compact ? "w-28" : "w-40")}>{illustration}</div>}
      <h3 className="text-[19px] font-semibold">{title}</h3>
      {description && <p className="text-label-2 mt-1.5 max-w-sm text-[15px] leading-6">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
