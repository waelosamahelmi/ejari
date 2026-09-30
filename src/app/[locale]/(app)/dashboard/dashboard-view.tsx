"use client";
import { Fragment, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  FilePlus2,
  Gavel,
  HandCoins,
  LayoutGrid,
  Printer,
  Search,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { WidgetCard } from "@/components/widgets/widget-card";
import { ProgressRing, BarMini, Donut, Meter } from "@/components/ui/charts";
import { RollingNumber } from "@/components/ui/rolling-number";
import { MonthPicker } from "@/components/ui/month-picker";
import { Chip, ChipScroller, Pill } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/input";
import { PropertyPhotoCard } from "@/components/ui/property-photo-card";
import { GlassPill } from "@/components/ui/glass";
import { GreetingHeader } from "@/components/ui/greeting-header";
import { HeaderUtilities, useShell } from "@/components/shell/app-shell";
import { useMoney, useNum, useSession } from "@/components/shell/prefs-context";
import { NoLateUnitsIllustration, NoVacantUnitsIllustration } from "@/components/illustrations";
import { savePreferences } from "@/server/actions/preferences";
import {
  dayNameAr,
  dayNameEn,
  formatDate,
  formatPeriod,
  monthNameAr,
  monthNameEn,
  parsePeriod,
  hourKuwait,
} from "@/domain/dates";
import { PERIOD_STATUS_STYLE } from "@/lib/status";
import type { DashboardData } from "@/server/queries/dashboard";
import { cn, firstName } from "@/lib/utils";
import { gentle } from "@/lib/motion";
import { WIDGETS, type Layout, type WidgetKey } from "./widgets-config";
import { InstallCard } from "@/components/pwa/install";

const TrendChart = dynamic(() => import("@/components/widgets/trend-chart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px]" />,
});

export function DashboardView({
  d,
  layout: initialLayout,
  filters,
}: {
  d: DashboardData;
  layout: Layout;
  filters: { propertyId: string | null; ownerId: string | null };
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tPeriod = useTranslations("enums.periodStatus");
  const tAging = useTranslations("enums.aging");
  const tNav = useTranslations("nav");
  const shell = useShell();
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const num = useNum();
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [, nav] = useTransition();
  const [layout, setLayout] = useState(initialLayout);
  const [customize, setCustomize] = useState(false);
  const available = WIDGETS.filter(
    (w) =>
      (w !== "cash" || d.cash) && (w !== "expenses" || d.expenses) && (w !== "legal" || d.legal),
  );
  const order = [
    ...layout.order.filter((w) => available.includes(w)),
    ...available.filter((w) => !layout.order.includes(w)),
  ];
  const visible = order.filter((w) => !layout.hidden.includes(w));

  const go = (p: { period?: string; property?: string | null; owner?: string | null }) =>
    nav(() => {
      const q = new URLSearchParams({ period: p.period ?? d.period });
      const prop = p.property === undefined ? filters.propertyId : p.property;
      const own = p.owner === undefined ? filters.ownerId : p.owner;
      if (prop) q.set("property", prop);
      if (own) q.set("owner", own);
      router.push(`${pathname}?${q.toString()}`);
    });

  const persist = (next: Layout) => {
    setLayout(next);
    void savePreferences({ dashboard_layout: next });
  };
  const move = (w: WidgetKey, dir: -1 | 1) => {
    const o = [...order];
    const i = o.indexOf(w);
    const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j]!, o[i]!];
    persist({ ...layout, order: o });
  };

  const c = d.collection;
  const rate = c.expectedFils ? c.collectedFils / c.expectedFils : 0;
  const prevRate = c.prevExpectedFils ? c.prevCollectedFils / c.prevExpectedFils : 0;
  const deltaPct = Math.round((rate - prevRate) * 100);
  const hour = hourKuwait();
  const greet =
    hour < 12
      ? tc("greeting.morning", { name: firstName(session.displayName) })
      : tc("greeting.evening", { name: firstName(session.displayName) });
  const monthShort = (p: string) =>
    (locale === "ar" ? monthNameAr : monthNameEn)(parsePeriod(p).m).slice(0, 3);

  const widget = (w: WidgetKey) => {
    switch (w) {
      case "today":
        return (
          <WidgetCard key={w} size="sm" title={t("today.title")}>
            <div className="text-[20px] font-semibold">
              {locale === "ar" ? dayNameAr(d.today) : dayNameEn(d.today)}
            </div>
            <div className="text-label-2 num text-[14px]">{formatDate(d.today)}</div>
            <div className="mt-auto pt-3 text-[14px]">
              {t("today.payments", { count: d.todayPayments })}
            </div>
          </WidgetCard>
        );
      case "collection":
        return (
          <WidgetCard
            key={w}
            size="lg"
            title={t("collection.title")}
            action={
              <Link href="/collections" className="text-link text-[13px] font-medium">
                {t("collection.open")}
              </Link>
            }
          >
            <Link
              href={`/collections?period=${d.period}`}
              className="flex flex-1 flex-col items-center justify-center gap-4 py-2"
            >
              <ProgressRing
                value={rate}
                size={188}
                stroke={18}
                label={`${Math.round(rate * 100)}%`}
                celebrate={rate >= 1 && c.expectedFils > 0}
              >
                <div>
                  <div className="num text-[34px] leading-none font-semibold">
                    {num(Math.round(rate * 100))}٪
                  </div>
                  {c.prevExpectedFils > 0 && (
                    <div
                      className={cn(
                        "mt-1 text-[12px] font-medium",
                        deltaPct >= 0 ? "text-green-text" : "text-red-text",
                      )}
                    >
                      {t("collection.delta", {
                        sign: deltaPct >= 0 ? "+" : "−",
                        pct: num(Math.abs(deltaPct)),
                      })}
                    </div>
                  )}
                </div>
              </ProgressRing>
              <div className="text-center">
                <RollingNumber
                  value={c.collectedFils}
                  format={(n) => money(n)}
                  className="num block text-[34px] leading-tight font-semibold"
                />
                <div className="text-label-2 num text-[14px]">
                  {t("collection.of", { amount: money(c.expectedFils) })}
                </div>
              </div>
            </Link>
          </WidgetCard>
        );
      case "arrears":
        return (
          <WidgetCard
            key={w}
            size="md"
            title={t("arrears.title")}
            action={
              <Link href="/reports/late" className="text-link text-[13px] font-medium">
                {tc("actions.viewAll")}
              </Link>
            }
          >
            {d.arrears.count === 0 ? (
              <div className="flex flex-1 items-center gap-4">
                <div className="w-20">
                  <NoLateUnitsIllustration />
                </div>
                <p className="text-[15px]">{t("arrears.none")}</p>
              </div>
            ) : (
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="num text-red-text text-[28px] font-semibold">
                    {money(d.arrears.totalFils)}
                  </div>
                  <div className="text-label-2 text-[13px]">
                    {t("arrears.units", { count: d.arrears.count })}
                  </div>
                  <BarMini
                    className="mt-3"
                    height={44}
                    items={(["d0_30", "d31_60", "d61_90", "d90_plus"] as const).map((k, i) => ({
                      label: tAging(k),
                      value: d.arrears.buckets[k],
                      color: i < 2 ? "var(--orange)" : "var(--red)",
                    }))}
                  />
                </div>
                <ul className="divide-separator divide-y-[0.5px]">
                  {d.arrears.top.map((r) => (
                    <li key={r.contractId}>
                      <Link
                        href={`/contracts/${r.contractId}`}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium">{r.tenant}</span>
                          <span className="text-label-2 block truncate text-[12px]">
                            {r.property} · {r.unit}
                          </span>
                        </span>
                        <span className="text-red-text shrink-0 text-[12px] font-semibold">
                          {t("arrears.days", { count: r.daysLate })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </WidgetCard>
        );
      case "occupancy":
        return (
          <WidgetCard key={w} size="sm" title={t("occupancy.title")}>
            <div className="flex flex-1 items-center justify-center">
              <Donut
                size={104}
                stroke={14}
                label={`${Math.round(d.occupancy.rate * 100)}%`}
                segments={[
                  { value: d.occupancy.occupied, color: "var(--green)" },
                  { value: d.occupancy.grace, color: "var(--teal)" },
                  { value: d.occupancy.vacant, color: "var(--gray)" },
                ]}
              >
                <span className="num text-[20px] font-semibold">
                  {num(Math.round(d.occupancy.rate * 100))}٪
                </span>
              </Donut>
            </div>
            <div className="text-label-2 mt-2 flex justify-center gap-3 text-[11px]">
              <span>
                ● {d.occupancy.occupied} {t("occupancy.occupied")}
              </span>
              <span>
                ● {d.occupancy.vacant} {t("occupancy.vacant")}
              </span>
            </div>
          </WidgetCard>
        );
      case "vacant":
        return (
          <WidgetCard
            key={w}
            size="md"
            title={t("vacant.title")}
            action={
              <Link href="/reports/vacant" className="text-link text-[13px] font-medium">
                {tc("actions.viewAll")}
              </Link>
            }
          >
            {d.vacant.length === 0 ? (
              <div className="flex flex-1 items-center gap-4">
                <div className="w-20">
                  <NoVacantUnitsIllustration />
                </div>
                <p className="text-[15px]">{t("vacant.none")}</p>
              </div>
            ) : (
              <ul className="divide-separator divide-y-[0.5px]">
                {d.vacant.map((v) => (
                  <li key={v.unitId} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/units/${v.unitId}`} className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">
                        {v.property} · {v.label}
                      </span>
                      <span className="text-label-2 block text-[12px]">
                        {t("vacant.days", { count: v.daysVacant })} ·{" "}
                        <span className="num">{money(v.askingRentFils)}</span>
                      </span>
                    </Link>
                    <Link
                      href={`/contracts/new?unit=${v.unitId}`}
                      className="text-link shrink-0 text-[13px] font-medium"
                    >
                      {t("vacant.create")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </WidgetCard>
        );
      case "cash":
        if (!d.cash) return null;
        return (
          <WidgetCard
            key={w}
            size="md"
            title={t("cash.title")}
            action={
              <Link
                href={`/deposits?period=${d.period}`}
                className="text-link text-[13px] font-medium"
              >
                {tc("actions.viewDetails")}
              </Link>
            }
          >
            <div
              className={cn(
                "num text-[28px] font-semibold",
                d.cash.differenceFils < 0
                  ? "text-red-text"
                  : d.cash.differenceFils > 0
                    ? "text-orange-text"
                    : "",
              )}
            >
              {money(d.cash.differenceFils)}
            </div>
            <div className="text-label-2 text-[13px]">{t("cash.onHand")}</div>
            <Meter
              className="mt-4"
              label={t("cash.title")}
              segments={
                d.cash.collectedFils > 0
                  ? [
                      {
                        value: d.cash.depositsFils / d.cash.collectedFils,
                        color: "var(--brand-gulf)",
                      },
                      { value: d.cash.expensesFils / d.cash.collectedFils, color: "var(--orange)" },
                    ]
                  : []
              }
            />
            <div className="text-label-2 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              <span>
                ● {t("cash.deposits")} <span className="num">{money(d.cash.depositsFils)}</span>
              </span>
              <span>
                ● {t("cash.expenses")} <span className="num">{money(d.cash.expensesFils)}</span>
              </span>
            </div>
            {d.cash.differenceFils < 0 && (
              <p className="text-red-text mt-2 text-[12px]">{t("cash.negative")}</p>
            )}
          </WidgetCard>
        );
      case "trend":
        return (
          <WidgetCard key={w} size="xl" title={t("trend.title")}>
            <TrendChart
              data={d.trend}
              format={(f) => money(f)}
              labels={{
                collected: t("trend.collected"),
                expected: t("trend.expected"),
                occupancy: t("trend.occupancy"),
              }}
            />
          </WidgetCard>
        );
      case "heatmap": {
        const periods = d.heatmap[0]?.cells.map((x) => x.period) ?? [];
        const groups = [...new Set(d.heatmap.map((r) => r.property))];
        return (
          <WidgetCard key={w} size="xl" title={t("heatmap.title")}>
            <div className="max-h-[460px] overflow-auto">
              <table className="border-separate border-spacing-[3px]">
                <thead className="bg-paper sticky top-0 z-[1]">
                  <tr>
                    <th />
                    {periods.map((p) => (
                      <th
                        key={p}
                        scope="col"
                        className="text-label-2 px-0.5 text-center text-[11px] font-medium"
                      >
                        {monthShort(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g}>
                      <tr>
                        <th
                          colSpan={periods.length + 1}
                          scope="rowgroup"
                          className="text-label-2 pt-2 text-start text-[12px] font-semibold"
                        >
                          {g}
                        </th>
                      </tr>
                      {d.heatmap
                        .filter((r) => r.property === g)
                        .map((r) => (
                          <tr key={r.unitId}>
                            <th
                              scope="row"
                              className="text-label-2 max-w-28 truncate pe-2 text-start text-[12px] font-medium"
                            >
                              <Link href={`/units/${r.unitId}`}>{r.label}</Link>
                            </th>
                            {r.cells.map((cell) => (
                              <td key={cell.period} className="p-0">
                                <span
                                  title={`${formatPeriod(cell.period, locale)} · ${t("heatmap.tip", { status: tPeriod(cell.status), paid: money(cell.paidFils), amount: money(cell.amountFils) })}${cell.receiptNos.length ? ` · #${cell.receiptNos.join(", ")}` : ""}`}
                                  className={cn(
                                    "block size-[22px] rounded-[6px] transition-transform hover:scale-110",
                                    PERIOD_STATUS_STYLE[cell.status].cell,
                                  )}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label={t("heatmap.legend")}>
              {(
                ["paid", "partial", "unpaid", "advance", "free", "vacant", "legal", "due"] as const
              ).map((s) => (
                <span key={s} className="text-label-2 flex items-center gap-1.5 text-[12px]">
                  <span className={cn("size-3 rounded-[4px]", PERIOD_STATUS_STYLE[s].cell)} />
                  {tPeriod(s)}
                </span>
              ))}
            </div>
          </WidgetCard>
        );
      }
      case "expiring":
        return (
          <WidgetCard
            key={w}
            size="md"
            title={t("expiring.title")}
            action={
              <Pill className="bg-orange/16 text-orange-text">
                {t("expiring.notices", { count: d.notices })}
              </Pill>
            }
          >
            {d.expiring.length === 0 ? (
              <p className="text-label-2 text-[14px]">{t("expiring.none")}</p>
            ) : (
              <ul className="divide-separator divide-y-[0.5px]">
                {d.expiring.map((e) => (
                  <li key={e.contractId}>
                    <Link
                      href={`/contracts/${e.contractId}`}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{e.tenant}</span>
                        <span className="text-label-2 block truncate text-[12px]">
                          {e.unit} · <span className="num">{formatDate(e.endDate)}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[12px] font-semibold">
                          {t("expiring.days", { count: e.daysLeft })}
                        </span>
                        {e.autoRenew && (
                          <Pill className="bg-teal/16 text-teal-text">
                            {t("expiring.autoRenew")}
                          </Pill>
                        )}
                        {e.notice && (
                          <Pill className="bg-orange/16 text-orange-text">
                            {t("expiring.notice")}
                          </Pill>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </WidgetCard>
        );
      case "first":
        return (
          <WidgetCard
            key={w}
            size="sm"
            title={t("first.title")}
            icon={<CalendarClock className="size-4" />}
          >
            {d.firstCollections.length === 0 ? (
              <p className="text-label-2 text-[14px]">{t("first.none")}</p>
            ) : (
              <ul className="space-y-2">
                {d.firstCollections.map((g) => (
                  <li key={g.contractId}>
                    <Link href={`/contracts/${g.contractId}`} className="block">
                      <span className="block truncate text-[14px] font-medium">{g.tenant}</span>
                      <span className="text-teal-text num text-[12px]">
                        {formatDate(g.date)} · {t("first.in", { count: g.daysUntil })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </WidgetCard>
        );
      case "expenses":
        if (!d.expenses) return null;
        return (
          <WidgetCard
            key={w}
            size="md"
            title={t("expenses.title")}
            action={
              <Link href="/expenses" className="text-link text-[13px] font-medium">
                {tc("actions.viewAll")}
              </Link>
            }
          >
            {d.expenses.totalFils === 0 ? (
              <p className="text-label-2 text-[14px]">{t("expenses.none")}</p>
            ) : (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
                <Donut
                  size={96}
                  stroke={12}
                  segments={d.expenses.byCategory.map((x, i) => ({
                    value: x.amountFils,
                    color: [
                      "var(--brand-gulf)",
                      "var(--brand-sand)",
                      "var(--teal)",
                      "var(--gray)",
                      "var(--indigo)",
                    ][i % 5]!,
                  }))}
                >
                  <Wallet className="text-label-2 size-5" />
                </Donut>
                <div className="min-w-0">
                  <div className="num text-[24px] font-semibold">{money(d.expenses.totalFils)}</div>
                  <ul className="mt-1 space-y-0.5">
                    {d.expenses.last.map((v) => (
                      <li key={v.id}>
                        <Link
                          href={`/expenses/${v.id}`}
                          className="text-label-2 flex justify-between gap-2 text-[12px]"
                        >
                          <span className="num">{v.no}</span>
                          <span className="num">{money(v.totalFils)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </WidgetCard>
        );
      case "legal":
        if (!d.legal) return null;
        return (
          <WidgetCard
            key={w}
            size="sm"
            title={t("legal.title")}
            icon={<Gavel className="size-4" />}
          >
            <Link href="/legal" className="flex flex-1 flex-col">
              <div className="num text-[28px] font-semibold">{d.legal.open}</div>
              <div className="text-label-2 text-[13px]">
                {t("legal.open", { count: d.legal.open })}
              </div>
              {d.legal.nextHearing && (
                <div className="text-red-text mt-auto pt-2 text-[12px] font-medium">
                  {t("legal.next", { date: formatDate(d.legal.nextHearing.date) })}
                </div>
              )}
            </Link>
          </WidgetCard>
        );
      case "quick":
        return (
          <WidgetCard key={w} size="sm" title={t("quick.title")}>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["/collections?pay=1", HandCoins, t("quick.payment"), "green"],
                ["/expenses/new", Wallet, t("quick.voucher"), "orange"],
                ["/contracts/new", FilePlus2, t("quick.contract"), "teal"],
                [`/collections?period=${d.period}`, Printer, t("quick.statement"), "gulf"],
              ].map(([href, Icon, label]) => {
                const I = Icon as typeof HandCoins;
                return (
                  <Link
                    key={href as string}
                    href={href as string}
                    className="bg-inset/70 press hover:bg-inset flex flex-col items-start gap-2 rounded-[14px] p-2.5 text-[12px] leading-4 font-medium"
                  >
                    <I className="size-5" />
                    {label as string}
                  </Link>
                );
              })}
            </div>
          </WidgetCard>
        );
    }
  };

  return (
    <div className="pt-[calc(12px+var(--safe-top))] lg:pt-6">
      {/* Mobile greeting header (§21.2) */}
      <div className="lg:hidden">
        <GreetingHeader greeting={greet} org={session.orgName} trailing={<HeaderUtilities />} />
      </div>
      <div className="hidden items-center justify-between lg:flex">
        <div>
          <p className="text-label-2 text-[15px]">{greet}</p>
          <h1 className="text-[34px] leading-tight font-normal tracking-tight">
            {t.rich("hero.title", {
              b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
            })}
          </h1>
        </div>
        <HeaderUtilities />
      </div>

      <InstallCard />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <MonthPicker value={d.period} onChange={(p) => go({ period: p })} />
        {d.owners.length > 1 && (
          <div className="w-48">
            <Select
              aria-label={t("filters.owner")}
              value={filters.ownerId ?? ""}
              onChange={(e) => go({ owner: e.target.value || null })}
              className="h-11"
            >
              <option value="">
                {t("filters.owner")}: {t("filters.all")}
              </option>
              {d.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button
          variant="secondary"
          size="icon"
          aria-label={t("customize")}
          onClick={() => setCustomize(true)}
          className="ms-auto"
        >
          <SlidersHorizontal />
        </Button>
      </div>
      <ChipScroller className="mt-3" ariaLabel={t("filters.property")}>
        <Chip active={!filters.propertyId} onClick={() => go({ property: null })}>
          <LayoutGrid className="size-4" />
          {t("filters.all")}
        </Chip>
        {d.properties.map((p) => (
          <Chip
            key={p.id}
            active={filters.propertyId === p.id}
            onClick={() => go({ property: p.id })}
          >
            {p.name}
          </Chip>
        ))}
      </ChipScroller>

      <div className="mt-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => shell?.openPalette()}
          className="bg-paper text-label-2 flex h-[52px] flex-1 items-center gap-3 rounded-full ps-4 text-start text-[16px] shadow-[0_1px_2px_rgba(16,24,40,.05)]"
        >
          <Search className="size-5" />
          {tNav("search")}
        </button>
      </div>
      {visible.includes("collection") && (
        <div className="mt-5 grid grid-cols-1 lg:hidden">{widget("collection")}</div>
      )}

      {!filters.propertyId && d.properties.length > 1 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[20px] font-semibold">{t("properties")}</h2>
            <Link href="/properties" className="text-link text-[15px] font-medium">
              {tc("actions.viewAll")}
            </Link>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {d.properties.map((p) => (
              <div
                key={p.id}
                className="w-[78vw] max-w-[340px] shrink-0 snap-start lg:w-auto lg:max-w-none"
              >
                <PropertyPhotoCard
                  LinkComponent={Link}
                  href={`/properties/${p.id}`}
                  name={p.name}
                  location={p.area ?? undefined}
                  photo={p.cover}
                  aspect="aspect-[4/5] lg:aspect-[4/4.6]"
                  ctaLabel={tc("actions.viewDetails")}
                  pills={
                    <>
                      <GlassPill>{num(Math.round(p.occupancyRate * 100))}٪</GlassPill>
                      {p.expectedFils > 0 && (
                        <GlassPill>
                          {num(Math.min(100, Math.round((p.collectedFils / p.expectedFils) * 100)))}
                          ٪ {t("trend.collected")}
                        </GlassPill>
                      )}
                      {p.arrearsFils > 0 && (
                        <GlassPill tone="danger">
                          {money(p.arrearsFils, { compact: true })}
                        </GlassPill>
                      )}
                    </>
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <motion.div
        layout
        className="mt-6 grid grid-flow-row-dense grid-cols-1 gap-4 min-[400px]:grid-cols-2 lg:grid-cols-4"
        transition={gentle}
      >
        {visible.map((w) =>
          w === "collection" ? (
            <div key={w} className="contents max-lg:hidden">
              {widget(w)}
            </div>
          ) : (
            widget(w)
          ),
        )}
      </motion.div>

      <Sheet
        open={customize}
        onOpenChange={setCustomize}
        title={t("customize")}
        footer={
          <Button block size="lg" onClick={() => setCustomize(false)}>
            {t("done")}
          </Button>
        }
      >
        <p className="text-label-2 mb-3 text-[13px]">{t("drag")}</p>
        <ul className="bg-paper divide-separator divide-y-[0.5px] overflow-hidden rounded-[20px]">
          {order.map((w, i) => (
            <li key={w} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1 text-[15px]">{t(`widgets.${w}`)}</span>
              <button
                type="button"
                aria-label={`${t(`widgets.${w}`)} ↑`}
                disabled={i === 0}
                onClick={() => move(w, -1)}
                className="bg-inset flex size-8 items-center justify-center rounded-full disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`${t(`widgets.${w}`)} ↓`}
                disabled={i === order.length - 1}
                onClick={() => move(w, 1)}
                className="bg-inset flex size-8 items-center justify-center rounded-full disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
              <Toggle
                checked={!layout.hidden.includes(w)}
                ariaLabel={t("show")}
                onCheckedChange={(on) =>
                  persist({
                    ...layout,
                    order,
                    hidden: on ? layout.hidden.filter((x) => x !== w) : [...layout.hidden, w],
                  })
                }
              />
            </li>
          ))}
        </ul>
        <Button
          variant="plain"
          className="mt-3"
          onClick={() => persist({ order: [...WIDGETS], hidden: [] })}
        >
          {t("reset")}
        </Button>
      </Sheet>
    </div>
  );
}
