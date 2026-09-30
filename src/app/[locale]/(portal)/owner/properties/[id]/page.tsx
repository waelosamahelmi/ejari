import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { loadOrgData } from "@/server/queries/dataset";
import { periodOf, todayKuwait } from "@/domain/dates";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { StatementEmbed } from "@/components/domain/properties/statement-embed";
import { Documents } from "@/components/domain/documents";
import { Button } from "@/components/ui/button";

export default async function OwnerPropertyPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale, { allowOwner: true });
  const data = await loadOrgData(ctx);
  const p = data.properties.get(id);
  if (!p) notFound();
  const t = await getTranslations("portal");
  const today = todayKuwait();
  return (
    <div className="pt-2">
      <LargeTitleHeader
        title={p.name}
        subtitle={p.area ?? undefined}
        back={{ href: "/owner", label: t("title") }}
        actions={
          <Button asChild variant="secondary" size="sm">
            <a
              href={`/print/report/accounting?preset=this_year&property=${id}&lang=${locale}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("accounting")}
            </a>
          </Button>
        }
      />
      <h2 className="mb-3 text-[20px] font-semibold">{t("statements")}</h2>
      <StatementEmbed propertyId={id} initialPeriod={periodOf(today)} canExport />
      <h2 className="mt-8 mb-3 text-[20px] font-semibold">{t("documents")}</h2>
      <Documents entityType="property" entityId={id} canEdit={false} />
    </div>
  );
}
