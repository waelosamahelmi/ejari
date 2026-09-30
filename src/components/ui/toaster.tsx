"use client";
import { Toaster as Sonner } from "sonner";
import { useDir } from "@/hooks/use-dir";

/** Sonner styled as iOS banners (top-center, material). */
export function Toaster() {
  const dir = useDir();
  return (
    <Sonner
      position="top-center"
      dir={dir}
      offset={16}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!material-sidebar !rounded-[18px] !border-0 !shadow-[var(--sh-float)] !text-label !px-4 !py-3 !gap-3 !font-[inherit] !text-[15px] !ring-1 !ring-black/5 dark:!ring-white/10",
          title: "!font-semibold",
          description: "!text-label-2",
          actionButton: "!bg-ink !text-on-ink !rounded-full !h-8 !px-3 !font-semibold",
          cancelButton: "!bg-inset !text-label !rounded-full !h-8 !px-3",
        },
      }}
    />
  );
}
