import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sticky bottom bar: key figure on the start side, primary pill on the end side (§21.1.15). */
export function StickyActionBar({ figure, caption, action, className }: { figure: ReactNode; caption?: ReactNode; action: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "material-bar border-separator fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] px-5 pt-3 pb-[calc(12px+var(--safe-bottom))] lg:sticky lg:bottom-4 lg:mx-auto lg:mt-6 lg:max-w-3xl lg:rounded-full lg:border lg:px-3 lg:py-2 lg:ps-6 lg:shadow-[var(--sh-float)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="num truncate text-[22px] font-semibold whitespace-nowrap">{figure}</div>
          {caption && <div className="text-label-2 truncate text-[13px]">{caption}</div>}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
