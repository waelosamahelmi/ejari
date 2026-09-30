"use client";
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** desktop panel width */
  size?: "md" | "lg" | "xl";
  /** hide the visual title (still announced) */
  hideTitle?: boolean;
  className?: string;
}

/**
 * Sheet: bottom drawer (vaul) with grabber on mobile, side panel sliding from
 * the END edge on desktop (left in RTL). 32px top radius on mobile (§21.1.10).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  hideTitle,
  className,
}: SheetProps) {
  const desktop = useIsDesktop();
  const t = useTranslations("common.actions");
  if (desktop) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/25" />
          <DialogPrimitive.Content
            className={cn(
              "bg-bg fixed inset-y-3 end-3 z-50 flex flex-col overflow-hidden rounded-[28px] shadow-[var(--sh-pop)] outline-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out duration-300 ease-[var(--ease-spring)]",
              "ltr:data-[state=open]:slide-in-from-right ltr:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-left",
              size === "md" && "w-[440px]",
              size === "lg" && "w-[600px]",
              size === "xl" && "w-[min(920px,calc(100vw-24px))]",
              className,
            )}
          >
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
              <div className={cn("min-w-0", hideTitle && "sr-only")}>
                <DialogPrimitive.Title className="truncate text-[22px] leading-7 font-semibold">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-label-2 text-[14px]">
                    {description}
                  </DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">
                    {title}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                className="bg-inset text-label-2 hover:text-label flex size-9 shrink-0 items-center justify-center rounded-full"
                aria-label={t("close")}
              >
                <X className="size-[18px]" />
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <div className="border-separator border-t-[0.5px] px-6 py-4">{footer}</div>}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Drawer.Content
          className={cn(
            "bg-bg fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-[32px] outline-none",
            className,
          )}
          aria-describedby={undefined}
        >
          <div
            className="mx-auto mt-2.5 h-[5px] w-9 shrink-0 rounded-full bg-[rgba(60,60,67,.3)]"
            aria-hidden
          />
          <div
            className={cn(
              "flex items-center justify-between gap-3 px-5 pt-3 pb-2",
              hideTitle && "sr-only",
            )}
          >
            <div className="min-w-0">
              <Drawer.Title className="truncate text-[20px] font-semibold">{title}</Drawer.Title>
              {description && (
                <Drawer.Description className="text-label-2 text-[14px]">
                  {description}
                </Drawer.Description>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && (
            <div className="border-separator border-t-[0.5px] px-5 pt-3 pb-[calc(12px+var(--safe-bottom))]">
              {footer}
            </div>
          )}
          {!footer && <div className="h-[var(--safe-bottom)] shrink-0" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
