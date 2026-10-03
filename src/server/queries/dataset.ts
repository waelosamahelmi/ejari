import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { fetchAll } from "@/server/db";
import { ensureChargesFresh } from "@/server/billing/ensure-charges";
import type { SessionContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Index, type Dataset, type RContract } from "@/domain/reports";
import type { ContractStatus, ContractType, LegalStatus, UnitType } from "@/domain/types";

export interface ContractMeta {
  id: string;
  contractNo: string;
  type: ContractType;
  status: ContractStatus;
  tenantId: string;
  propertyId: string;
  unitIds: string[];
  startDate: string;
  endDate: string;
  firstCollectionDate: string;
  monthlyRentFils: number;
  noticeDate: string | null;
  expectedMoveOut: string | null;
  autoRenew: boolean;
}

export interface OrgData {
  ds: Dataset;
  idx: Index;
  tenants: Map<
    string,
    { id: string; fullName: string; phones: string[]; civilId: string | null; blacklisted: boolean }
  >;
  owners: Map<string, { id: string; fullName: string }>;
  properties: Map<
    string,
    {
      id: string;
      name: string;
      nameEn: string | null;
      area: string | null;
      governorate: string | null;
      propertyType: string;
      coverImagePath: string | null;
      photos: { path: string; blur?: string }[];
      floors: number | null;
      active: boolean;
    }
  >;
  units: Map<
    string,
    {
      id: string;
      propertyId: string;
      label: string;
      type: UnitType;
      floor: number | null;
      underMaintenance: boolean;
      askingRentFils: number;
      areaM2: number | null;
      bedrooms: number | null;
      bathrooms: number | null;
      photos: { path: string; blur?: string }[];
    }
  >;
}

/**
 * Loads the org's operational dataset (RLS-scoped) for the pure report/ledger
 * functions. Cached per request. Office-scale data (hundreds of units, a few
 * thousand charges) is loaded whole — see DECISIONS.md.
 */
export const loadOrgData = cache(async (ctx: SessionContext): Promise<OrgData> => {
  await ensureChargesFresh(ctx.orgId, ctx.settings);
  const db = await supabaseServer();
  return fetchOrgData(db, ctx.orgId, {
    finance: can(ctx.role, "view_expenses") || ctx.role === "owner",
    legal: ctx.role !== "owner",
  });
});

/**
 * Builds the dataset with any client. Every query is filtered by org_id explicitly so
 * the service-role client (cron) stays scoped to one org; RLS still applies to users.
 */
export async function fetchOrgData(
  db: SupabaseClient<Database>,
  orgId: string,
  opts: { finance: boolean; legal: boolean },
): Promise<OrgData> {
  const finance = opts.finance;
  const [
    properties,
    units,
    contracts,
    charges,
    payments,
    allocations,
    adjustments,
    legal,
    tenants,
    owners,
    propertyOwners,
    commissions,
  ] = await Promise.all([
    fetchAll((f, t) =>
      db
        .from("properties")
        .select(
          "id, name, name_en, area, governorate, property_type, cover_image_path, photos, floors, active",
        )
        .eq("org_id", orgId)
        .order("name")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("units")
        .select(
          "id, property_id, label, sort_order, type, floor, area_m2, bedrooms, bathrooms, asking_rent_fils, active, under_maintenance, photos, available_since",
        )
        .eq("org_id", orgId)
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("contracts")
        .select(
          "id, contract_no, type, status, tenant_id, property_id, start_date, end_date, first_collection_date, move_out_date, monthly_rent_fils, auto_renew, notice_date, expected_move_out, free_months, contract_units(unit_id, rent_share_fils)",
        )
        .eq("org_id", orgId)
        .neq("status", "draft")
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("charges")
        .select(
          "id, contract_id, period, kind, amount_fils, waived_value_fils, due_date, voided, description",
        )
        .eq("org_id", orgId)
        .eq("voided", false)
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("payments")
        .select("id, contract_id, tenant_id, amount_fils, received_at, receipt_no, voided")
        .eq("org_id", orgId)
        .eq("voided", false)
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("payment_allocations")
        .select("payment_id, charge_id, amount_fils")
        .eq("org_id", orgId)
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("adjustments")
        .select("id, contract_id, charge_id, kind, amount_fils, adjustment_date, reason")
        .eq("org_id", orgId)
        .range(f, t),
    ),
    !opts.legal
      ? Promise.resolve([])
      : fetchAll((f, t) =>
          db
            .from("legal_cases")
            .select("id, contract_id, tenant_id, status, next_hearing_date, case_no")
            .eq("org_id", orgId)
            .range(f, t),
        ),
    fetchAll((f, t) =>
      db
        .from("tenants")
        .select("id, full_name, phones, civil_id, blacklisted")
        .eq("org_id", orgId)
        .range(f, t),
    ),
    fetchAll((f, t) => db.from("owners").select("id, full_name").eq("org_id", orgId).range(f, t)),
    fetchAll((f, t) =>
      db
        .from("property_owners")
        .select("property_id, owner_id, share_pct")
        .eq("org_id", orgId)
        .range(f, t),
    ),
    fetchAll((f, t) =>
      db
        .from("property_commissions")
        .select("property_id, kind, value, effective_from")
        .eq("org_id", orgId)
        .order("effective_from")
        .range(f, t),
    ),
  ]);
  const [expenseAllocs, vouchers, deposits] = finance
    ? await Promise.all([
        fetchAll((f, t) =>
          db
            .from("expense_allocations")
            .select(
              "property_id, unit_id, amount_fils, expense_lines!inner(id, description, category_id, beneficiary_id, expense_categories(name_ar, name_en, type), beneficiaries(name), expense_vouchers!inner(id, voucher_no, voucher_date, status))",
            )
            .eq("org_id", orgId)
            .eq("expense_lines.expense_vouchers.status", "posted")
            .range(f, t),
        ),
        fetchAll((f, t) =>
          db
            .from("expense_vouchers")
            .select("id, voucher_no, voucher_date, status, expense_lines(amount_fils)")
            .eq("org_id", orgId)
            .range(f, t),
        ),
        fetchAll((f, t) =>
          db
            .from("deposits")
            .select(
              "id, deposit_date, amount_fils, owner_id, destination, deposit_properties(property_id, amount_fils)",
            )
            .eq("org_id", orgId)
            .range(f, t),
        ),
      ])
    : [[], [], []];

  const tenantMap = new Map(
    tenants.map((t) => [
      t.id,
      {
        id: t.id,
        fullName: t.full_name,
        phones: t.phones ?? [],
        civilId: t.civil_id,
        blacklisted: t.blacklisted,
      },
    ]),
  );
  const ownerMap = new Map(owners.map((o) => [o.id, { id: o.id, fullName: o.full_name }]));
  const poByProp = new Map<string, { ownerId: string; share: number }[]>();
  for (const po of propertyOwners) {
    const arr = poByProp.get(po.property_id) ?? [];
    arr.push({ ownerId: po.owner_id, share: Number(po.share_pct) });
    poByProp.set(po.property_id, arr);
  }
  const commissionByProp = new Map<string, { kind: "percent" | "fixed"; value: number }>();
  for (const c of commissions)
    commissionByProp.set(c.property_id, { kind: c.kind, value: Number(c.value) });

  const ds: Dataset = {
    properties: properties.map((p) => {
      const pos = poByProp.get(p.id) ?? [];
      return {
        id: p.id,
        name: p.name,
        area: p.area,
        ownerIds: pos.map((x) => x.ownerId),
        ownerNames: pos.map((x) => ownerMap.get(x.ownerId)?.fullName ?? ""),
        commission: commissionByProp.get(p.id) ?? null,
      };
    }),
    units: units.map((u) => ({
      id: u.id,
      propertyId: u.property_id,
      label: u.label,
      sortOrder: u.sort_order,
      type: u.type,
      floor: u.floor,
      areaM2: u.area_m2 === null ? null : Number(u.area_m2),
      askingRentFils: u.asking_rent_fils,
      active: u.active,
      availableFrom: u.available_since,
    })),
    contracts: contracts.map((c): RContract => {
      const t = tenantMap.get(c.tenant_id);
      const cu = c.contract_units ?? [];
      return {
        id: c.id,
        contractNo: c.contract_no,
        type: c.type,
        status: c.status,
        tenantId: c.tenant_id,
        tenantName: t?.fullName ?? "",
        tenantPhones: t?.phones ?? [],
        propertyId: c.property_id,
        unitIds: cu.map((x) => x.unit_id),
        unitShares:
          cu.every((x) => x.rent_share_fils !== null) && cu.length > 0
            ? cu.map((x) => x.rent_share_fils!)
            : null,
        startDate: c.start_date,
        endDate: c.end_date,
        firstCollectionDate: c.first_collection_date,
        moveOutDate: c.move_out_date,
        monthlyRentFils: c.monthly_rent_fils,
        autoRenew: c.auto_renew,
        noticeDate: c.notice_date,
        expectedMoveOut: c.expected_move_out,
        freeMonths: c.free_months,
      };
    }),
    charges: charges.map((c) => ({
      id: c.id,
      contractId: c.contract_id,
      period: c.period,
      kind: c.kind,
      amountFils: c.amount_fils,
      waivedValueFils: c.waived_value_fils,
      dueDate: c.due_date,
      voided: c.voided,
      description: c.description,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      contractId: p.contract_id,
      tenantId: p.tenant_id,
      amountFils: p.amount_fils,
      receivedAt: p.received_at,
      receiptNo: p.receipt_no,
      voided: p.voided,
    })),
    allocations: allocations.map((a) => ({
      paymentId: a.payment_id,
      chargeId: a.charge_id,
      amountFils: a.amount_fils,
    })),
    adjustments: adjustments.map((a) => ({
      id: a.id,
      contractId: a.contract_id,
      chargeId: a.charge_id,
      kind: a.kind,
      amountFils: a.amount_fils,
      date: a.adjustment_date,
      reason: a.reason,
    })),
    legalCases: legal.map((l) => ({
      id: l.id,
      contractId: l.contract_id,
      tenantId: l.tenant_id,
      status: l.status as LegalStatus,
      nextHearingDate: l.next_hearing_date,
      caseNo: l.case_no,
    })),
    expenseAllocations: expenseAllocs.map((e) => {
      const line = e.expense_lines as unknown as {
        id: string;
        description: string;
        category_id: string;
        beneficiary_id: string | null;
        expense_categories: { name_ar: string; name_en: string; type: string } | null;
        beneficiaries: { name: string } | null;
        expense_vouchers: { id: string; voucher_no: string; voucher_date: string };
      };
      return {
        voucherId: line.expense_vouchers.id,
        voucherNo: line.expense_vouchers.voucher_no,
        voucherDate: line.expense_vouchers.voucher_date,
        lineId: line.id,
        propertyId: e.property_id,
        unitId: e.unit_id,
        amountFils: e.amount_fils,
        categoryId: line.category_id,
        categoryName: line.expense_categories?.name_ar ?? "",
        categoryType: line.expense_categories?.type,
        beneficiaryId: line.beneficiary_id,
        beneficiaryName: line.beneficiaries?.name ?? null,
        description: line.description,
      };
    }),
    vouchers: vouchers.map((v) => ({
      id: v.id,
      voucherNo: v.voucher_no,
      date: v.voucher_date,
      status: v.status,
      totalFils: (v.expense_lines ?? []).reduce((s, l) => s + l.amount_fils, 0),
    })),
    deposits: deposits.map((d) => ({
      id: d.id,
      date: d.deposit_date,
      amountFils: d.amount_fils,
      ownerId: d.owner_id,
      destination: d.destination,
      properties: (d.deposit_properties ?? []).map((x) => ({
        propertyId: x.property_id,
        amountFils: x.amount_fils,
      })),
    })),
    propertyOwners: propertyOwners.map((po) => ({
      propertyId: po.property_id,
      ownerId: po.owner_id,
      sharePct: Number(po.share_pct),
    })),
  };
  return {
    ds,
    idx: new Index(ds),
    tenants: tenantMap,
    owners: ownerMap,
    properties: new Map(
      properties.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          nameEn: p.name_en,
          area: p.area,
          governorate: p.governorate,
          propertyType: p.property_type,
          coverImagePath: p.cover_image_path,
          photos: (p.photos as { path: string; blur?: string }[] | null) ?? [],
          floors: p.floors,
          active: p.active,
        },
      ]),
    ),
    units: new Map(
      units.map((u) => [
        u.id,
        {
          id: u.id,
          propertyId: u.property_id,
          label: u.label,
          type: u.type,
          floor: u.floor,
          underMaintenance: u.under_maintenance,
          askingRentFils: u.asking_rent_fils,
          areaM2: u.area_m2 === null ? null : Number(u.area_m2),
          bedrooms: u.bedrooms,
          bathrooms: u.bathrooms,
          photos: (u.photos as { path: string; blur?: string }[] | null) ?? [],
        },
      ]),
    ),
  };
}
