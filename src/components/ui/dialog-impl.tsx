"use client";
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Centered alert-style dialog (destructive actions in red). */
export function AlertDialogImpl({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
  loading,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[60] bg-black/30" />
        <DialogPrimitive.Content
          role="alertdialog"
          className={cn(
            "bg-paper fixed start-1/2 top-1/2 z-[60] w-[min(400px,calc(100vw-32px))] -translate-y-1/2 rounded-[28px] p-6 shadow-[var(--sh-pop)] outline-none ltr:-translate-x-1/2 rtl:translate-x-1/2",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="text-center text-[19px] font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="text-label-2 mt-2 text-center text-[15px] leading-6">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <DialogPrimitive.Close asChild>
              <Button variant="tinted" size="lg">
                {cancelLabel}
              </Button>
            </DialogPrimitive.Close>
            <Button
              variant={destructive ? "destructive" : "primary"}
              size="lg"
              onClick={onConfirm}
              loading={loading}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
