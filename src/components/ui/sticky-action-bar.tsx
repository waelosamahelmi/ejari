import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sticky bottom bar: key figure on the start side, primary pill on the end side (§21.1.15). */
export function StickyActionBar({
  figure,
  caption,
  action,
  className,
}: {
  figure: ReactNode;
  caption?: ReactNode;
  action: ReactNode;
  className?: string;
}) {
  return (
    <>
      {/* Mobile: floats just above the floating tab bar; the spacer keeps content clear of it. */}
      <div aria-hidden className="h-24 lg:hidden" />
      <div
        className={cn(
          "material-bar border-separator fixed inset-x-3 bottom-[calc(88px+var(--safe-bottom))] z-30 rounded-[24px] border-[0.5px] px-4 py-2.5 shadow-[var(--sh-float)] lg:sticky lg:inset-x-auto lg:bottom-4 lg:mx-auto lg:mt-6 lg:max-w-3xl lg:rounded-full lg:border lg:px-3 lg:py-2 lg:ps-6 lg:shadow-[var(--sh-float)]",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="num truncate text-[18px] font-semibold whitespace-nowrap sm:text-[22px]">
              {figure}
            </div>
            {caption && <div className="text-label-2 truncate text-[13px]">{caption}</div>}
          </div>
          <div className="shrink-0">{action}</div>
        </div>
      </div>
    </>
  );
}
