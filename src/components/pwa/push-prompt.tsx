"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { pushSupport, subscribePush } from "@/lib/push/client";

export const ASK_PUSH_EVENT = "ijari:ask-push";
const ASKED_KEY = "ijari-push-asked";

/**
 * Branded pre-permission sheet (§19.6): never on load — only in context, e.g. after
 * the first recorded payment. Asked once per device; Settings → Notifications can
 * always enable it later.
 */
export function PushPrompt() {
  const t = useTranslations("pwa.push");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ask = () => {
      try {
        if (localStorage.getItem(ASKED_KEY)) return;
      } catch {
        return;
      }
      const s = pushSupport();
      if (s !== "supported" || Notification.permission !== "default") return;
      setOpen(true);
    };
    window.addEventListener(ASK_PUSH_EVENT, ask);
    return () => window.removeEventListener(ASK_PUSH_EVENT, ask);
  }, []);

  const close = () => {
    try {
      localStorage.setItem(ASKED_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title={t("askTitle")}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            block
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await subscribePush(locale);
              setBusy(false);
              if (r === "ok") toast.success(t("enabled"));
              else if (r === "denied") toast.error(t("denied"));
              close();
            }}
          >
            {t("allow")}
          </Button>
          <Button size="lg" block variant="secondary" onClick={close}>
            {t("notNow")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center py-2 text-center">
        <span className="bg-ink text-on-ink mb-4 flex size-16 items-center justify-center rounded-[20px]">
          <BellRing className="size-8" aria-hidden />
        </span>
        <p className="text-label-2 max-w-[34ch] text-[16px] leading-7">{t("askText")}</p>
      </div>
    </Sheet>
  );
}
