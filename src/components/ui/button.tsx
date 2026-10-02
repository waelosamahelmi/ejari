import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "press no-select inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background,color,box-shadow,opacity] focus-visible:outline-2 disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-on-ink hover:opacity-90",
        secondary:
          "bg-paper text-label shadow-[0_1px_2px_rgba(16,24,40,.06)] ring-1 ring-separator hover:bg-paper-2",
        tinted:
          "bg-inset text-label hover:bg-[color-mix(in_srgb,var(--bg-inset)_80%,var(--label)_6%)]",
        glass: "glass text-white hover:bg-white/30",
        white: "bg-white text-[#0E0F12] hover:bg-white/90",
        // Ink text on brand rose: 5.3:1 (white would be 3.4:1).
        rose: "bg-rose text-[#0E0F12] hover:opacity-90",
        destructive: "bg-red text-white hover:opacity-90",
        plain: "text-link hover:opacity-75",
        ghost: "text-label hover:bg-inset",
      },
      size: {
        lg: "h-[52px] px-6 text-[16px]",
        md: "h-11 px-5 text-[15px]",
        sm: "h-9 px-4 text-[14px]",
        icon: "size-11",
        "icon-sm": "size-9",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, disabled, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="size-4" />}
          {children}
        </>
      )}
    </Comp>
  );
});
