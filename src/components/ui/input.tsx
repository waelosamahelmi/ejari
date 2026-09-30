import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputBase =
  "bg-paper text-label placeholder:text-label-3 ring-separator focus:ring-link w-full rounded-[14px] px-4 text-[16px] ring-1 transition-shadow outline-none focus:ring-2 disabled:opacity-50 aria-[invalid=true]:ring-red";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputBase, "h-[52px]", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(inputBase, "min-h-[96px] resize-y py-3 leading-6", className)} {...props} />;
});

/** Native select styled as an iOS picker (best mobile UX, fully accessible). */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputBase, "h-[52px] appearance-none pe-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="text-label-3 pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2" aria-hidden />
    </div>
  );
});

export function Field({
  label,
  htmlFor,
  hint,
  error,
  warning,
  children,
  className,
  trailing,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  children: ReactNode;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between gap-2 px-1">
          {label && (
            <label htmlFor={htmlFor} className="text-label-2 text-[13px] font-medium">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-red-text px-1 text-[13px] leading-5">
          {error}
        </p>
      ) : warning ? (
        <p className="text-orange-text px-1 text-[13px] leading-5">{warning}</p>
      ) : hint ? (
        <p className="text-label-2 px-1 text-[13px] leading-5">{hint}</p>
      ) : null}
    </div>
  );
}
