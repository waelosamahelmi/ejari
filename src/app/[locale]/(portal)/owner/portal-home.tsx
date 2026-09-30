"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Photo } from "@/components/ui/photo";
import { PropertyPhotoCard } from "@/components/ui/property-photo-card";
import { GlassPill } from "@/components/ui/glass";
import { Card } from "@/components/ui/card";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { EmptyState } from "@/components/ui/empty-state";
import { NoPropertiesIllustration } from "@/components/illustrations";
import { useMoney, useNum } from "@/components/shell/prefs-context";
import { PHOTOS } from "@/config/generated-assets";
import { formatDate, formatPeriod } from "@/domain/dates";
import type { PropertySummary } from "@/server/queries/properties";
import { useLocale } from "next-intl";
import { firstName } from "@/lib/utils";

export function PortalHome({
  name,
  period,
  properties,
  summary,
  ytd,
  deposits,
}: {
  name: string;
  period: string;
  properties: (PropertySummary & { coverUrl: string | null })[];
  summary: { collected: number; deposits: number; expenses: number };
  ytd: { net: number; deposits: number; balance: number } | null;
  deposits: { id: string; date: string; amountFils: number }[];
}) {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const tDep = useTranslations("deposits.summary");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const num = useNum();
  return (
    <div className="space-y-6 pt-4">
      <Photo
        src={PHOTOS["hero-evening"].src}
        name="owner"
        alt=""
        priority
        scrim="bottom"
        className="h-[260px] rounded-[32px]"
      >
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <p className="text-[15px] text-white/80">{t("subtitle")}</p>
          <h1 className="text-[34px] leading-tight font-normal">
            {t("welcome", { name: firstName(name) })}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassPill>{formatPeriod(period, locale)}</GlassPill>
            <GlassPill>
              {tDep("collected")}: {money(summary.collected)}
            </GlassPill>
            <GlassPill className="bg-[color-mix(in_srgb,var(--brand-sand)_45%,transparent)]">
              {tDep("deposits")}: {money(summary.deposits)}
            </GlassPill>
          </div>
        </div>
      </Photo>
      {ytd && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [t("ytdNet"), ytd.net],
            [t("ytdDeposits"), ytd.deposits],
            [t("ytdBalance"), ytd.balance],
          ].map(([l, v]) => (
            <Card key={l as string} className="p-5">
              <div className="text-label-2 text-[13px]">{l}</div>
              <div className="num text-[24px] font-semibold">{money(v as number)}</div>
            </Card>
          ))}
        </div>
      )}
      <section>
        <h2 className="mb-3 text-[20px] font-semibold">{t("properties")}</h2>
        {properties.length === 0 ? (
          <EmptyState illustration={<NoPropertiesIllustration />} title={t("noProperties")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <PropertyPhotoCard
                key={p.id}
                LinkComponent={Link}
                href={`/owner/properties/${p.id}`}
                name={p.name}
                location={p.area ?? undefined}
                photo={p.coverUrl}
                ctaLabel={t("statements")}
                pills={
                  <>
                    <GlassPill>{num(Math.round(p.occupancyRate * 100))}٪</GlassPill>
                    <GlassPill>{money(p.collectedFils)}</GlassPill>
                    {p.arrearsFils > 0 && (
                      <GlassPill tone="danger">{money(p.arrearsFils)}</GlassPill>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
      <GroupedSection header={t("deposits")}>
        {deposits.length === 0 ? (
          <ListRow title={tc("labels.none")} />
        ) : (
          deposits.map((d) => (
            <ListRow
              key={d.id}
              title={<span className="num">{formatDate(d.date)}</span>}
              trailing={<span className="num">{money(d.amountFils)}</span>}
            />
          ))
        )}
      </GroupedSection>
    </div>
  );
}
