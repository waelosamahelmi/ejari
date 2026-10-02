import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WidgetSize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-full min-[400px]:col-span-2",
  lg: "col-span-full min-[400px]:col-span-2 lg:row-span-2",
  xl: "col-span-full lg:col-span-4",
};

/** Bento widget card: sm 1×1, md 2×1, lg 2×2, xl 4×2. */
export function WidgetCard({
  size,
  title,
  action,
  children,
  className,
  icon,
  shotMask,
  tourId,
}: {
  size: WidgetSize;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  /** Marks widgets whose content depends on today's date, so visual regression can mask them. */
  shotMask?: boolean;
  /** Guided-tour target id (rendered as data-tour). */
  tourId?: string;
}) {
  return (
    <section
      data-shot-mask={shotMask ? "true" : undefined}
      data-tour={tourId}
      className={cn("card flex min-h-[168px] flex-col p-5", SIZE[size], className)}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-label-2 flex items-center gap-2 text-[14px] font-semibold">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
