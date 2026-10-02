"use client";
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePwa } from "@/components/pwa/pwa-provider";
import { IosInstallGuide } from "@/components/pwa/install";

export function InstallView() {
  const t = useTranslations("pwa.install");
  const ts = useTranslations("settings.items");
  const { canInstall, promptInstall, ios, standalone } = usePwa();
  const [guide, setGuide] = useState(false);
  return (
    <SettingsShell title={ts("install")}>
      <Card data-tour="install-card" className="flex flex-col items-center p-8 text-center">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={88}
          height={88}
          className="mb-5 rounded-[22px] shadow-[0_8px_28px_rgba(16,24,40,.18)]"
        />
        <h2 className="text-[22px] font-semibold">{t("title")}</h2>
        <p className="text-label-2 mt-1.5 max-w-[40ch] text-[15px] leading-6">{t("text")}</p>
        <div className="mt-6 w-full max-w-xs">
          {standalone ? (
            <p className="text-green-text flex items-center justify-center gap-2 text-[15px] font-medium">
              <CheckCircle2 className="size-5" />
              {t("installed")}
            </p>
          ) : canInstall ? (
            <Button size="lg" block onClick={() => void promptInstall()}>
              {t("action")}
            </Button>
          ) : ios ? (
            <Button size="lg" block onClick={() => setGuide(true)}>
              {t("iosShowMe")}
            </Button>
          ) : (
            <p className="text-label-2 text-[14px] leading-6">{t("unsupported")}</p>
          )}
        </div>
      </Card>
      <IosInstallGuide open={guide} onOpenChange={setGuide} />
    </SettingsShell>
  );
}
