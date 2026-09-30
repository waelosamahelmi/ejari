import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { loadOrgData } from "@/server/queries/dataset";
import { todayKuwait } from "@/domain/dates";
import { balanceSummary, daysLate } from "@/domain/ledger";
import { maskCivilId } from "@/domain/validation";
import { can } from "@/lib/permissions";
import { TenantsView, type TenantRow } from "./tenants-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "tenants" });
  return { title: t("title") };
}

export default async function TenantsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const rows: TenantRow[] = [...data.tenants.values()].map((t) => {
    const cs = data.ds.contracts.filter((c) => c.tenantId === t.id);
    let arrears = 0;
    let credit = 0;
    let late = 0;
    for (const c of cs) {
      const l = data.idx.ledger(c.id);
      const b = balanceSummary(l, today);
      arrears += b.arrearsFils;
      credit += b.creditFils;
      late = Math.max(late, daysLate(l, today));
    }
    const live = cs.filter((c) => c.status === "active" || c.status === "notice_given");
    return {
      id: t.id,
      name: t.fullName,
      civilIdMasked: maskCivilId(t.civilId),
      phone: t.phones[0] ?? null,
      units: live.map(
        (c) =>
          `${data.properties.get(c.propertyId)?.name ?? ""} · ${c.unitIds.map((u) => data.units.get(u)?.label).join(", ")}`,
      ),
      arrearsFils: arrears,
      creditFils: credit,
      daysLate: late,
      active: live.length > 0,
      blacklisted: t.blacklisted,
    };
  });
  rows.sort((a, b) => b.arrearsFils - a.arrearsFils || a.name.localeCompare(b.name, "ar"));
  return <TenantsView rows={rows} canEdit={can(ctx.role, "manage_master_data")} />;
}
