"use client";
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { prefetchWhenIdle } from "./sheet";

export interface AlertDialogProps {
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
}

const load = () => import("./dialog-impl").then((m) => m.AlertDialogImpl);
const AlertDialogImpl = dynamic(load, { ssr: false });

/** Centered alert-style dialog (destructive actions in red); implementation code-split like Sheet. */
export function AlertDialog(props: AlertDialogProps) {
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true);
  useEffect(() => prefetchWhenIdle(load), []);
  return used ? <AlertDialogImpl {...props} /> : null;
}
