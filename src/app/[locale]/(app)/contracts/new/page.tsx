import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { buildingStack } from "@/server/queries/properties";
import { loadTemplate } from "@/server/queries/contracts";
import { periodOf, todayKuwait } from "@/domain/dates";
import { maskCivilId } from "@/domain/validation";
import type { ContractDraftInput } from "@/lib/schemas/contract";
import { ContractWizard } from "./wizard";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "contracts.wizard" });
  return { title: t("title") };
}

export default async function NewContractPage({ params, searchParams }: LocaleParams & { searchParams: Promise<{ unit?: string; draft?: string; property?: string; tenant?: string }> }) {
  const { locale } = await pageLocale(params);
  const sp = await searchParams;
  const ctx = await requireContext(locale, { capability: "manage_contracts" });
  const db = await supabaseServer();
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const period = periodOf(today);
  const [resTpl, invTpl, { data: propOwners }] = await Promise.all([
    loadTemplate(db, "residential"),
    loadTemplate(db, "investment"),
    db.from("property_owners").select("property_id, owner_id, share_pct"),
  ]);
  const properties = [...data.properties.values()].filter((p) => p.active).map((p) => ({
    id: p.id,
    name: locale === "en" && p.nameEn ? p.nameEn : p.name,
    propertyType: p.propertyType,
    ownerIds: (propOwners ?? []).filter((po) => po.property_id === p.id).sort((a, b) => Number(b.share_pct) - Number(a.share_pct)).map((po) => po.owner_id),
    stack: buildingStack(data, p.id, period, today),
  }));
  let initial: (ContractDraftInput & { id?: string }) | null = null;
  if (sp.draft) {
    const { data: c } = await db.from("contracts").select("*, contract_units(unit_id, rent_share_fils)").eq("id", sp.draft).eq("status", "draft").maybeSingle();
    if (c)
      initial = {
        id: c.id,
        type: c.type,
        ownerId: c.owner_id,
        tenantId: c.tenant_id,
        propertyId: c.property_id,
        unitIds: (c.contract_units ?? []).map((u) => u.unit_id),
        contractDate: c.contract_date,
        startDate: c.start_date,
        firstCollectionDate: c.first_collection_date,
        termMonths: c.term_months,
        autoRenew: c.auto_renew,
        renewalTermMonths: c.renewal_term_months,
        monthlyRentFils: c.monthly_rent_fils,
        purpose: c.purpose,
        utilitiesParty: c.utilities_party,
        electricityFixedFils: c.electricity_fixed_fils,
        freeMonths: c.free_months,
        freeMonthsPenaltyWindowMonths: c.free_months_penalty_window_months,
        noticePeriodMonths: c.notice_period_months,
        securityDepositFils: c.security_deposit_fils,
        annualIncrease: c.annual_increase_kind ? { kind: c.annual_increase_kind, value: Number(c.annual_increase_value), everyMonths: c.annual_increase_every_months ?? 12 } : null,
        clauseOverrides: (c.clause_overrides ?? {}) as ContractDraftInput["clauseOverrides"],
        customClauses: (c.custom_clauses ?? []) as { key: string; text: string }[],
        notes: c.notes,
      };
  }
  const unit = sp.unit ? data.units.get(sp.unit) : undefined;
  return (
    <ContractWizard
      today={today}
      initial={initial}
      preset={{ propertyId: unit?.propertyId ?? sp.property ?? null, unitId: unit?.id ?? null, tenantId: sp.tenant ?? null }}
      properties={properties}
      owners={[...data.owners.values()].map((o) => ({ id: o.id, name: o.fullName }))}
      tenants={[...data.tenants.values()].map((t) => ({ id: t.id, name: t.fullName, civilIdMasked: maskCivilId(t.civilId), civilId: t.civilId ?? "", phones: t.phones, blacklisted: t.blacklisted }))}
      templates={{
        residential: resTpl.clauses.map((c) => ({ key: c.key, optional: !!c.optional, body: c.body })),
        investment: invTpl.clauses.map((c) => ({ key: c.key, optional: !!c.optional, body: c.body })),
      }}
    />
  );
}
