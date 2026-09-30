"use client";
import { useState } from "react";
import { BellRing, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PaymentSheet } from "./payment-sheet";
import { ReminderSheet } from "./reminder-sheet";

export function RecordPaymentButton({ contractId, variant = "primary", size = "lg", className, label }: { contractId: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string; label?: string }) {
  const t = useTranslations("collections.actions");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <HandCoins />
        {label ?? t("record")}
      </Button>
      <PaymentSheet open={open} onOpenChange={setOpen} contractId={open ? contractId : null} />
    </>
  );
}

export function RemindButton({ contractId, className }: { contractId: string; className?: string }) {
  const t = useTranslations("collections.actions");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="tinted" block className={className} onClick={() => setOpen(true)}>
        <BellRing />
        {t("remind")}
      </Button>
      <ReminderSheet open={open} onOpenChange={setOpen} contractId={open ? contractId : null} />
    </>
  );
}
