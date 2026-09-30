import { Bell, Building, CalendarCheck2, Download, FileText, Hash, MessageSquareText, Palette, Receipt, Tags, UserCog, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { can, type Capability } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { GroupedList, GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile, type Tone } from "@/components/ui/icon-tile";

type Item = { key: "org" | "users" | "templates" | "categories" | "beneficiaries" | "numbering" | "billing" | "reminder" | "preferences" | "notifications" | "export" | "closings"; icon: typeof Bell; tone: Tone; cap?: Capability };
const GROUPS: { key: "office" | "people" | "documents" | "finance" | "you" | "data"; items: Item[] }[] = [
  { key: "office", items: [{ key: "org", icon: Building, tone: "ink", cap: "manage_org" }, { key: "numbering", icon: Hash, tone: "gray", cap: "manage_org" }, { key: "billing", icon: Receipt, tone: "green", cap: "manage_master_data" }, { key: "reminder", icon: MessageSquareText, tone: "teal", cap: "send_reminder" }] },
  { key: "people", items: [{ key: "users", icon: Users, tone: "indigo", cap: "manage_users" }] },
  { key: "documents", items: [{ key: "templates", icon: FileText, tone: "gulf", cap: "manage_templates" }] },
  { key: "finance", items: [{ key: "categories", icon: Tags, tone: "orange", cap: "manage_expenses" }, { key: "beneficiaries", icon: UserCog, tone: "sand", cap: "manage_expenses" }, { key: "closings", icon: CalendarCheck2, tone: "red", cap: "close_month" }] },
  { key: "you", items: [{ key: "preferences", icon: Palette, tone: "rose" }, { key: "notifications", icon: Bell, tone: "red" }] },
  { key: "data", items: [{ key: "export", icon: Download, tone: "gray", cap: "view_reports" }] },
];

export default async function SettingsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const t = await getTranslations("settings");
  return (
    <>
      <LargeTitleHeader title={t("title")} subtitle={ctx.orgName} />
      <GroupedList className="max-w-2xl">
        {GROUPS.map((g) => {
          const items = g.items.filter((i) => !i.cap || can(ctx.role, i.cap));
          if (!items.length) return null;
          return (
            <GroupedSection key={g.key} header={t(`groups.${g.key}`)}>
              {items.map((i) => (
                <ListRow key={i.key} LinkComponent={Link} href={`/settings/${i.key}`} leading={<IconTile tone={i.tone}><i.icon /></IconTile>} title={t(`items.${i.key}`)} chevron />
              ))}
            </GroupedSection>
          );
        })}
      </GroupedList>
    </>
  );
}
