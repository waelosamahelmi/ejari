"use client";
import { cloneElement, createContext, useContext, useEffect, useState, type ComponentProps, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { prefetchWhenIdle } from "./sheet";

type Impl = typeof import("./popover-impl");
const load = () => import("./popover-impl");

const Ctx = createContext<{ impl: Impl | null; requestOpen: () => void }>({ impl: null, requestOpen: () => {} });

/**
 * Popover with a code-split implementation (Radix + floating positioning load on
 * idle or first open). Same API as Radix: Popover / PopoverTrigger asChild / PopoverContent.
 */
export function Popover({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (o: boolean) => void; children: ReactNode }) {
  const [impl, setImpl] = useState<Impl | null>(null);
  useEffect(() => prefetchWhenIdle(load), []);
  useEffect(() => {
    if (open && !impl) void load().then(setImpl);
  }, [open, impl]);
  const requestOpen = () => {
    void load().then((m) => {
      setImpl(m);
      onOpenChange?.(true);
    });
  };
  if (!impl) return <Ctx.Provider value={{ impl: null, requestOpen }}>{children}</Ctx.Provider>;
  const { Root } = impl;
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <Ctx.Provider value={{ impl, requestOpen }}>{children}</Ctx.Provider>
    </Root>
  );
}

export function PopoverTrigger({ children }: { asChild?: boolean; children: ReactElement<{ onClick?: (e: MouseEvent) => void }> }) {
  const { impl, requestOpen } = useContext(Ctx);
  if (impl) return <impl.Trigger asChild>{children}</impl.Trigger>;
  return cloneElement(children, {
    "aria-haspopup": "dialog",
    "aria-expanded": false,
    onClick: (e: MouseEvent) => {
      children.props.onClick?.(e);
      requestOpen();
    },
  } as Partial<typeof children.props>);
}

export function PopoverContent(props: ComponentProps<Impl["Content"]>) {
  const { impl } = useContext(Ctx);
  return impl ? <impl.Content {...props} /> : null;
}
