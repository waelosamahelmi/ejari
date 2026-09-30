"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { reopenMonth } from "@/server/actions/payments";
import { formatDate, formatPeriod } from "@/domain/dates";

export function ClosingsView({
  title,
  rows,
  canReopen,
}: {
  title: string;
  rows: { period: string; closedAt: string; notes: string | null }[];
  canReopen: boolean;
}) {
  const t = useTranslations("settings.closings");
  const tc = useTranslations("common.actions");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { exec, pending } = useAction();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <SettingsShell title={title}>
      <GroupedSection header={t("title")}>
        {rows.length === 0 ? (
          <ListRow title={t("none")} />
        ) : (
          rows.map((r) => (
            <ListRow
              key={r.period}
              leading={
                <IconTile tone="red">
                  <Lock />
                </IconTile>
              }
              title={formatPeriod(r.period, locale)}
              subtitle={`${t("closedAt", { date: formatDate(r.closedAt.slice(0, 10)) })}${r.notes ? ` · ${r.notes}` : ""}`}
              trailing={
                canReopen ? (
                  <Button size="sm" variant="tinted" onClick={() => setConfirm(r.period)}>
                    {t("reopen")}
                  </Button>
                ) : undefined
              }
            />
          ))
        )}
      </GroupedSection>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t("reopenConfirm", { month: formatPeriod(confirm, locale) }) : ""}
        description={t("reopenText")}
        confirmLabel={t("reopen")}
        cancelLabel={tc("cancel")}
        loading={pending}
        onConfirm={() =>
          confirm &&
          exec(() => reopenMonth(confirm), {
            onSuccess: () => {
              setConfirm(null);
              router.refresh();
            },
          })
        }
      />
    </SettingsShell>
  );
}
