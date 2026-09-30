"use client";
import type { ComponentProps, ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "material-sidebar z-50 min-w-[220px] overflow-hidden rounded-[16px] p-1.5 shadow-[var(--sh-pop)] ring-1 ring-black/5 dark:ring-white/10",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, icon, children, ...props }: ComponentProps<typeof Menu.Item> & { destructive?: boolean; icon?: ReactNode }) {
  return (
    <Menu.Item
      className={cn(
        "flex h-10 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[15px] outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-[color-mix(in_srgb,var(--label)_8%,transparent)] [&_svg]:size-[18px]",
        destructive ? "text-red-text" : "text-label",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </Menu.Item>
  );
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="bg-separator mx-2 my-1 h-px" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="text-label-2 px-3 py-1.5 text-[12px] font-medium">{children}</Menu.Label>;
}
