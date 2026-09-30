import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Round 44px frosted-glass icon button for use over photos (§21.1.2). */
export const GlassButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { size?: "md" | "lg" }>(
  function GlassButton({ className, size = "md", type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "glass press inline-flex items-center justify-center rounded-full text-white shadow-[0_2px_12px_rgba(0,0,0,.12)] [&_svg]:size-5",
          size === "md" ? "size-11" : "size-12",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Glass metadata pill ("٩ وحدات", "٩٦٪ محصل"). `tone="danger"` gives a red-tinted glass. */
export function GlassPill({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "danger" | "strong" }) {
  return (
    <span
      className={cn(
        "glass inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-white [&_svg]:size-3.5",
        tone === "danger" && "bg-[rgba(255,59,48,.38)]",
        tone === "strong" && "glass-strong",
        className,
      )}
      {...props}
    />
  );
}
