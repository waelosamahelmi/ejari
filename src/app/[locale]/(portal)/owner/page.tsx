import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { loadOrgData } from "@/server/queries/dataset";
import { propertySummaries } from "@/server/queries/properties";
import { signPaths } from "@/server/storage";
import { periodOf, todayKuwait } from "@/domain/dates";
import { monthlySummary, ownerStatement } from "@/domain/reports";
import { PortalHome } from "./portal-home";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "portal" });
  return { title: t("title") };
}

export default async function OwnerHome({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { allowOwner: true });
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const period = periodOf(today);
  const ownerId = ctx.ownerIds[0] ?? null;
  const props = propertySummaries(data, period, today);
  const signed = await signPaths(
    "media",
    props.map((p) => p.cover),
  );
  const summary = monthlySummary(data.idx, period, ownerId ? { ownerId } : {});
  const statement = ownerId
    ? ownerStatement(data.idx, ownerId, `${today.slice(0, 4)}-01`, period)
    : null;
  return (
    <PortalHome
      name={ctx.displayName}
      period={period}
      properties={props.map((p) => ({
        ...p,
        coverUrl: p.cover ? (signed.get(p.cover) ?? null) : null,
      }))}
      summary={{
        collected: summary.collectedFils,
        deposits: summary.depositsFils,
        expenses: summary.expensesFils,
      }}
      ytd={
        statement
          ? {
              net: statement.netPayableFils,
              deposits: statement.depositsFils,
              balance: statement.balanceFils,
            }
          : null
      }
      deposits={data.ds.deposits
        .filter(
          (d) =>
            !ownerId ||
            d.ownerId === ownerId ||
            d.properties.some((x) => props.some((p) => p.id === x.propertyId)),
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12)
        .map((d) => ({
          id: d.id,
          date: d.date,
          amountFils: d.properties.length
            ? d.properties
                .filter((x) => props.some((p) => p.id === x.propertyId))
                .reduce((s, x) => s + x.amountFils, 0)
            : d.amountFils,
        }))}
    />
  );
}
