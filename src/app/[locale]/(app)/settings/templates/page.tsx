import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Pill } from "@/components/ui/chip";

export default async function TemplatesPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  await requireContext(locale, { capability: "manage_templates" });
  const db = await supabaseServer();
  const { data } = await db
    .from("contract_templates")
    .select("id, type, name, version, org_id, is_default, created_at")
    .order("type")
    .order("version", { ascending: false });
  const t = await getTranslations("settings");
  const tType = await getTranslations("enums.contractType");
  return (
    <SettingsShell title={t("items.templates")}>
      {(["residential", "investment"] as const).map((type) => (
        <GroupedSection key={type} header={tType(type)}>
          {(data ?? [])
            .filter((x) => x.type === type)
            .map((x) => (
              <ListRow
                key={x.id}
                LinkComponent={Link}
                href={`/settings/templates/${x.id}`}
                leading={
                  <IconTile tone={x.org_id ? "gulf" : "gray"}>
                    <FileText />
                  </IconTile>
                }
                title={x.name}
                subtitle={`${t("templates.version", { n: x.version })} · ${x.org_id ? t("templates.custom") : t("templates.system")}`}
                trailing={
                  x.is_default ? (
                    <Pill className="bg-green/14 text-green-text">{t("templates.default")}</Pill>
                  ) : undefined
                }
                chevron
              />
            ))}
        </GroupedSection>
      ))}
    </SettingsShell>
  );
}
