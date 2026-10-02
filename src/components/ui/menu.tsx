"use client";
import { cloneElement, createContext, useContext, useEffect, useState, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { prefetchWhenIdle } from "./sheet";

type Impl = typeof import("./menu-impl");
const load = () => import("./menu-impl");
const Ctx = createContext<{ impl: Impl | null; requestOpen: () => void }>({ impl: null, requestOpen: () => {} });

/**
 * Dropdown menu with a code-split implementation (Radix menu + floating positioning
 * load on idle or first open). Same API as before: DropdownMenu / Trigger asChild /
 * Content / Item / Label / Separator. Items only ever render inside an open Content.
 */
export function DropdownMenu({ open, onOpenChange, defaultOpen, children }: { open?: boolean; onOpenChange?: (o: boolean) => void; defaultOpen?: boolean; children: ReactNode }) {
  const [impl, setImpl] = useState<Impl | null>(null);
  const [initialOpen, setInitialOpen] = useState(!!defaultOpen);
  useEffect(() => prefetchWhenIdle(load), []);
  useEffect(() => {
    if ((open || defaultOpen) && !impl) void load().then(setImpl);
  }, [open, defaultOpen, impl]);
  const requestOpen = () =>
    void load().then((m) => {
      setImpl(m);
      setInitialOpen(true);
      onOpenChange?.(true);
    });
  if (!impl) return <Ctx.Provider value={{ impl: null, requestOpen }}>{children}</Ctx.Provider>;
  const { Root } = impl;
  return (
    <Root open={open} onOpenChange={onOpenChange} defaultOpen={open === undefined ? initialOpen : undefined}>
      <Ctx.Provider value={{ impl, requestOpen }}>{children}</Ctx.Provider>
    </Root>
  );
}

type TriggerProps = { asChild?: boolean; children: ReactElement<{ onClick?: (e: MouseEvent) => void }> | ReactNode; className?: string; "aria-label"?: string };

export function DropdownMenuTrigger({ asChild, children, ...rest }: TriggerProps) {
  const { impl, requestOpen } = useContext(Ctx);
  if (impl)
    return (
      <impl.Trigger asChild={asChild} {...rest}>
        {children}
      </impl.Trigger>
    );
  const open = () => requestOpen();
  if (asChild && children && typeof children === "object" && "props" in children) {
    const el = children as ReactElement<{ onClick?: (e: MouseEvent) => void }>;
    return cloneElement(el, {
      "aria-haspopup": "menu",
      "aria-expanded": false,
      onClick: (e: MouseEvent) => {
        el.props.onClick?.(e);
        open();
      },
    } as Partial<typeof el.props>);
  }
  return (
    <button type="button" aria-haspopup="menu" aria-expanded={false} onClick={open} {...rest}>
      {children}
    </button>
  );
}

export function DropdownMenuContent(props: ComponentProps<Impl["Content"]>) {
  const { impl } = useContext(Ctx);
  return impl ? <impl.Content {...props} /> : null;
}

export function DropdownMenuItem(props: ComponentProps<Impl["Item"]>) {
  const { impl } = useContext(Ctx);
  return impl ? <impl.Item {...props} /> : null;
}

export function DropdownMenuSeparator() {
  const { impl } = useContext(Ctx);
  return impl ? <impl.Separator /> : null;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  const { impl } = useContext(Ctx);
  return impl ? <impl.Label>{children}</impl.Label> : null;
}

export function DropdownMenuCheckboxItem(props: ComponentProps<Impl["CheckboxItem"]>) {
  const { impl } = useContext(Ctx);
  return impl ? <impl.CheckboxItem {...props} /> : null;
}
