import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ExportPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  await requireContext(locale, { capability: "view_reports" });
  const t = await getTranslations("settings");
  return (
    <SettingsShell title={t("items.export")}>
      <Card className="space-y-4 p-6">
        <h2 className="text-[20px] font-semibold">{t("export.title")}</h2>
        <p className="text-label-2 text-[15px] leading-6">{t("export.text")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={`/api/export/all?lang=${locale}`}>
              <Download />
              {t("export.download")}
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href={`/api/export/all?format=csv&lang=${locale}`}>
              <Download />
              {t("export.csv")}
            </a>
          </Button>
        </div>
      </Card>
    </SettingsShell>
  );
}
