"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Full-width 52px pill search field (§21.1.12). */
export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onValueChange: (v: string) => void; clearLabel?: string; size?: "md" | "lg" }
>(function SearchField({ className, value, onValueChange, clearLabel = "Clear", size = "lg", ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search className="text-label-2 pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2" aria-hidden />
      <input
        ref={ref}
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "bg-paper text-label placeholder:text-label-2 focus:ring-link w-full rounded-full ps-12 pe-11 text-[16px] shadow-[0_1px_2px_rgba(16,24,40,.05)] outline-none focus:ring-2 [&::-webkit-search-cancel-button]:hidden",
          size === "lg" ? "h-[52px]" : "h-11",
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className="bg-label-3 text-paper absolute end-3.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full"
        >
          <X className="size-3" strokeWidth={3} />
        </button>
      )}
    </div>
  );
});
