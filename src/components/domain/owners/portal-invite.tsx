"use client";
import { CheckCircle2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { inviteOwnerToPortal } from "@/server/actions/users";

export function PortalInviteCard({ ownerId, email, linked, canInvite }: { ownerId: string; email: string; linked: boolean; canInvite: boolean }) {
  const t = useTranslations("portal");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <Card className="space-y-3 p-5">
      <h3 className="text-[17px] font-semibold">{t("title")}</h3>
      <p className="text-label-2 text-[14px]">{t("portalHint")}</p>
      {linked ? (
        <p className="text-green-text flex items-center gap-2 text-[14px] font-medium"><CheckCircle2 className="size-4" />{t("linked")}</p>
      ) : !email ? (
        <p className="text-orange-text text-[14px]">{t("needEmail")}</p>
      ) : null}
      {canInvite && email && (
        <Button variant={linked ? "secondary" : "primary"} loading={pending} onClick={() => exec(() => inviteOwnerToPortal(ownerId, locale), { onSuccess: (e) => { toast.success(t("invited", { email: e })); router.refresh(); } })}>
          <Send />
          {t("invite")}
        </Button>
      )}
    </Card>
  );
}
