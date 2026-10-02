import { getTranslations } from "next-intl/server";
import { Compass, Download } from "lucide-react";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { GroupedList, GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { navFor } from "@/components/shell/nav-config";
import { requireContext } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { pageLocale, type LocaleParams } from "@/lib/i18n";

export default async function MorePage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const items = navFor(ctx.role);
  const sections = (["work", "finance", "records", "admin"] as const)
    .map((s) => ({ s, items: items.filter((i) => i.section === s) }))
    .filter((x) => x.items.length);
  return (
    <>
      <LargeTitleHeader title={t("more")} />
      <GroupedList>
        {sections.map(({ s, items }) => (
          <GroupedSection key={s} header={t(`sections.${s}`)}>
            {items.map((n) => {
              const Icon = n.icon;
              return (
                <ListRow
                  key={n.key}
                  LinkComponent={Link}
                  href={n.href}
                  leading={
                    <IconTile tone={n.tone}>
                      <Icon />
                    </IconTile>
                  }
                  title={t(n.key)}
                  chevron
                />
              );
            })}
          </GroupedSection>
        ))}
        <GroupedSection header={t("sections.help")}>
          <ListRow
            LinkComponent={Link}
            href={`/dashboard?tour=1`}
            leading={
              <IconTile tone="gulf">
                <Compass />
              </IconTile>
            }
            title={tc("guide")}
            chevron
          />
          <ListRow
            LinkComponent={Link}
            href="/settings/install"
            leading={
              <IconTile tone="teal">
                <Download />
              </IconTile>
            }
            title={t("install")}
            chevron
          />
        </GroupedSection>
      </GroupedList>
    </>
  );
}
