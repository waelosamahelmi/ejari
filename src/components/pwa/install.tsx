"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Share, SquarePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { usePwa } from "./pwa-provider";

const DISMISS_KEY = "ijari-install-dismissed";

/** iOS Safari: illustrated 3-step "Add to Home Screen" guide (§19.1). */
export function IosInstallGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("pwa.install");
  const steps = [
    { key: "share", icon: Share },
    { key: "add", icon: SquarePlus },
    { key: "confirm", icon: Check },
  ] as const;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("iosTitle")}
      description={t("iosText")}
      footer={
        <Button size="lg" block onClick={() => onOpenChange(false)}>
          {t("done")}
        </Button>
      }
    >
      <ol className="space-y-3">
        {steps.map(({ key, icon: Icon }, i) => (
          <li
            key={key}
            className="bg-paper flex items-center gap-4 rounded-[20px] p-4 shadow-[var(--sh-card)]"
          >
            <span className="num bg-inset text-label-2 flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold">
              {i + 1}
            </span>
            <span className="flex-1 text-[16px] leading-6">{t(`iosSteps.${key}`)}</span>
            <span className="bg-ink text-on-ink flex size-11 shrink-0 items-center justify-center rounded-[14px]">
              <Icon className="size-5" aria-hidden />
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/**
 * Branded, dismissible install card for the dashboard: from the 2nd session only,
 * never when already running standalone (§19.1).
 */
export function InstallCard() {
  const t = useTranslations("pwa.install");
  const { canInstall, promptInstall, ios, standalone, sessions } = usePwa();
  const [dismissed, setDismissed] = useState(true);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    try {
      setDismissed(!!localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissed(true);
    }
  }, []);
  if (standalone || dismissed || sessions < 2 || !(canInstall || ios)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
  };
  return (
    <>
      <div className="relative mt-5 flex items-center gap-4 overflow-hidden rounded-[28px] bg-[var(--brand-dusk)] p-4 pe-12 shadow-[var(--sh-card)] sm:p-5 sm:pe-14">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="size-14 shrink-0 rounded-[14px] shadow-[0_4px_16px_rgba(16,24,40,.18)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-[#0E0F12] dark:text-white">{t("title")}</p>
          <p className="mt-0.5 text-[14px] leading-5 text-[#0E0F12]/70 dark:text-white/70">
            {t("text")}
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={async () => (canInstall ? await promptInstall() : setGuide(true))}
          >
            {canInstall ? t("action") : t("iosShowMe")}
          </Button>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="press absolute end-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/50 text-[#0E0F12] dark:bg-black/30 dark:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      <IosInstallGuide open={guide} onOpenChange={setGuide} />
    </>
  );
}
