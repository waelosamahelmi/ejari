"use client";
import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { buildReminder, logReminder } from "@/server/actions/payments";
import { whatsappLink } from "@/domain/validation";

/** WhatsApp reminder: editable Arabic/English message from the org template; logs each send. */
export function ReminderSheet({ open, onOpenChange, contractId }: { open: boolean; onOpenChange: (o: boolean) => void; contractId: string | null }) {
  const t = useTranslations("payments.reminder");
  const locale = useLocale() as "ar" | "en";
  const [msg, setMsg] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>("");
  useEffect(() => {
    if (!open || !contractId) return;
    setMsg(null);
    void buildReminder(contractId, locale).then((r) => {
      if (r.ok) {
        setMsg(r.data.message);
        setPhone(r.data.phone);
        setTenantId(r.data.tenantId);
      }
    });
  }, [open, contractId, locale]);
  const log = (channel: "whatsapp" | "copy") => logReminder({ tenantId, contractId, message: msg ?? "", channel }).then(() => toast.success(t("logged")));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" disabled={!msg} onClick={async () => { await navigator.clipboard.writeText(msg ?? ""); await log("copy"); onOpenChange(false); }}>
            <Copy />
            {t("copy")}
          </Button>
          <Button size="lg" disabled={!msg || !phone} onClick={async () => { window.open(whatsappLink(phone!, msg ?? ""), "_blank"); await log("whatsapp"); onOpenChange(false); }}>
            <MessageCircle />
            {t("send")}
          </Button>
        </div>
      }
    >
      {msg === null ? <Skeleton className="h-40" /> : <Textarea rows={8} aria-label={t("title")} value={msg} onChange={(e) => setMsg(e.target.value)} />}
    </Sheet>
  );
}
