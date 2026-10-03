"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import {
  beneficiarySchema,
  categorySchema,
  createPlannedUnitsSchema,
  createPropertyWithPlanSchema,
  ownerSchema,
  plannedUnitSchema,
  propertySchema,
  tenantSchema,
  unitSchema,
  type CreatePlannedUnitsInput,
  type CreatePropertyWithPlanInput,
  type OwnerInput,
  type PropertyInput,
  type TenantInput,
  type UnitInput,
} from "@/lib/schemas/master";

const reval = () => revalidatePath("/[locale]", "layout");

// ---------------------------------------------------------------- owners
export async function saveOwner(id: string | null, input: OwnerInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = ownerSchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      full_name: d.fullName,
      civil_id: d.civilId,
      phones: d.phones,
      email: d.email,
      iban: d.iban,
      bank_name: d.bankName,
      address: d.address,
      notes: d.notes,
    };
    const res = id
      ? await db.from("owners").update(row).eq("id", id).select("id").single()
      : await db.from("owners").insert(row).select("id").single();
    if (res.error) throw res.error;
    reval();
    return res.data.id;
  });
}

export async function deleteOwner(id: string) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    const db = await supabaseServer();
    const { error } = await db.from("owners").delete().eq("id", id);
    if (error) throw error;
    reval();
  });
}

// ---------------------------------------------------------------- properties
type Supa = Awaited<ReturnType<typeof supabaseServer>>;

async function writePropertyRelations(
  db: Supa,
  ctx: { orgId: string },
  pid: string,
  d: z.output<typeof propertySchema>,
) {
  // Replace owner shares.
  const del = await db.from("property_owners").delete().eq("property_id", pid);
  if (del.error) throw del.error;
  const ins = await db
    .from("property_owners")
    .insert(
      d.owners.map((o) => ({
        org_id: ctx.orgId,
        property_id: pid,
        owner_id: o.ownerId,
        share_pct: o.sharePct,
      })),
    );
  if (ins.error) throw ins.error;
  if (d.commission !== undefined) {
    await db.from("property_commissions").delete().eq("property_id", pid);
    if (d.commission) {
      const c = await db
        .from("property_commissions")
        .insert({
          org_id: ctx.orgId,
          property_id: pid,
          kind: d.commission.kind,
          value: d.commission.value,
        });
      if (c.error) throw c.error;
    }
  }
}

function plannedUnitRows(
  orgId: string,
  propertyId: string,
  units: z.output<typeof plannedUnitSchema>[],
  startSort: number,
) {
  let sort = startSort;
  return units.map((u) => ({
    org_id: orgId,
    property_id: propertyId,
    label: u.label,
    sort_order: ++sort,
    type: u.type,
    floor: u.floor,
    area_m2: u.areaM2,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    asking_rent_fils: u.askingRentFils,
  }));
}

export async function saveProperty(id: string | null, input: PropertyInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = propertySchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name: d.name,
      name_en: d.nameEn,
      governorate: d.governorate,
      area: d.area,
      block: d.block,
      street: d.street,
      avenue: d.avenue,
      house_or_plot: d.houseOrPlot,
      paci_no: d.paciNo,
      property_type: d.propertyType,
      floors: d.floors ?? null,
      notes: d.notes,
    };
    const res = id
      ? await db.from("properties").update(row).eq("id", id).select("id").single()
      : await db.from("properties").insert(row).select("id").single();
    if (res.error) throw res.error;
    await writePropertyRelations(db, ctx, res.data.id, d);
    reval();
    return res.data.id;
  });
}

/**
 * Creates a property and (optionally) its planned units. If the units insert fails the
 * property row is deleted, so a "property saved" toast never hides a lost unit plan.
 */
export async function createPropertyWithPlan(input: CreatePropertyWithPlanInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = createPropertyWithPlanSchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name: d.property.name,
      name_en: d.property.nameEn,
      governorate: d.property.governorate,
      area: d.property.area,
      block: d.property.block,
      street: d.property.street,
      avenue: d.property.avenue,
      house_or_plot: d.property.houseOrPlot,
      paci_no: d.property.paciNo,
      property_type: d.property.propertyType,
      floors: d.property.floors ?? null,
      notes: d.property.notes,
    };
    const res = await db.from("properties").insert(row).select("id").single();
    if (res.error) throw res.error;
    const pid = res.data.id;
    try {
      await writePropertyRelations(db, ctx, pid, d.property);
      if (d.units.length > 0) {
        const rows = plannedUnitRows(ctx.orgId, pid, d.units, 0);
        const insUnits = await db.from("units").insert(rows);
        if (insUnits.error) throw insUnits.error;
      }
    } catch (e) {
      await db.from("properties").delete().eq("id", pid);
      throw e;
    }
    reval();
    return pid;
  });
}

export async function setPropertyActive(id: string, active: boolean) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    const db = await supabaseServer();
    const { error } = await db.from("properties").update({ active }).eq("id", id);
    if (error) throw error;
    reval();
  });
}

export async function togglePinnedProperty(id: string) {
  return run(async () => {
    const ctx = await requireActionContext();
    const db = await supabaseServer();
    const { data } = await db
      .from("user_settings")
      .select("pinned_property_ids")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const cur = new Set(data?.pinned_property_ids ?? []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    const { error } = await db
      .from("user_settings")
      .upsert({ user_id: ctx.userId, org_id: ctx.orgId, pinned_property_ids: [...cur] });
    if (error) throw error;
    return cur.has(id);
  });
}

// ---------------------------------------------------------------- units
function unitRow(orgId: string, d: z.output<typeof unitSchema>) {
  return {
    org_id: orgId,
    property_id: d.propertyId,
    label: d.label,
    sort_order: d.sortOrder,
    type: d.type,
    floor: d.floor ?? null,
    area_m2: d.areaM2 ?? null,
    bedrooms: d.bedrooms ?? null,
    bathrooms: d.bathrooms ?? null,
    paci_no: d.paciNo,
    asking_rent_fils: d.askingRentFils,
    elec_meter_no: d.elecMeterNo,
    water_meter_no: d.waterMeterNo,
    notes: d.notes,
    active: d.active,
    ...(d.availableSince ? { available_since: d.availableSince } : {}),
  };
}

export async function saveUnit(id: string | null, input: UnitInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = unitSchema.parse(input);
    const db = await supabaseServer();
    if (!id && !input.sortOrder) {
      const { data: last } = await db
        .from("units")
        .select("sort_order")
        .eq("property_id", d.propertyId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      d.sortOrder = (last?.sort_order ?? 0) + 1;
    }
    const row = unitRow(ctx.orgId, d);
    const res = id
      ? await db.from("units").update(row).eq("id", id).select("id").single()
      : await db.from("units").insert(row).select("id").single();
    if (res.error) throw res.error;
    reval();
    return res.data.id;
  });
}

/** Creates the units of a property detail planner. One insert; labels unique per property. */
export async function createPlannedUnits(input: CreatePlannedUnitsInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = createPlannedUnitsSchema.parse(input);
    const db = await supabaseServer();
    const { data: property } = await db
      .from("properties")
      .select("id")
      .eq("id", d.propertyId)
      .maybeSingle();
    if (!property) throw new ActionError("notFound");
    const { data: existing } = await db
      .from("units")
      .select("label, sort_order")
      .eq("property_id", d.propertyId);
    const existingLabels = new Set((existing ?? []).map((u) => u.label.trim().toLowerCase()));
    for (const u of d.units) {
      if (existingLabels.has(u.label.trim().toLowerCase())) throw new ActionError("duplicate");
    }
    const startSort = Math.max(0, ...(existing ?? []).map((u) => u.sort_order));
    const rows = plannedUnitRows(ctx.orgId, d.propertyId, d.units, startSort);
    const { error } = await db.from("units").insert(rows);
    if (error) throw error;
    reval();
    return rows.length;
  });
}

export async function setUnitMaintenance(id: string, underMaintenance: boolean) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    const db = await supabaseServer();
    const { error } = await db
      .from("units")
      .update({ under_maintenance: underMaintenance })
      .eq("id", id);
    if (error) throw error;
    reval();
  });
}

export async function deleteUnit(id: string) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    const db = await supabaseServer();
    const { error } = await db.from("units").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        // Has contracts: deactivate instead of deleting history.
        const u = await db.from("units").update({ active: false }).eq("id", id);
        if (u.error) throw u.error;
        reval();
        return "deactivated" as const;
      }
      throw error;
    }
    reval();
    return "deleted" as const;
  });
}

// ---------------------------------------------------------------- tenants
export async function saveTenant(id: string | null, input: TenantInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = tenantSchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      full_name: d.fullName,
      civil_id: d.civilId,
      nationality: d.nationality,
      phones: d.phones,
      email: d.email,
      employer: d.employer,
      emergency_contact: d.emergencyContact,
      notes: d.notes,
    };
    const res = id
      ? await db.from("tenants").update(row).eq("id", id).select("id, full_name").single()
      : await db.from("tenants").insert(row).select("id, full_name").single();
    if (res.error) throw res.error;
    reval();
    return res.data;
  });
}

export async function setBlacklist(id: string, blacklisted: boolean, reason: string | null) {
  return run(async () => {
    await requireActionContext("manage_master_data");
    if (blacklisted && !reason?.trim()) throw new ActionError("validation");
    const db = await supabaseServer();
    const { error } = await db
      .from("tenants")
      .update({ blacklisted, blacklist_reason: blacklisted ? reason : null })
      .eq("id", id);
    if (error) throw error;
    reval();
  });
}

/** Finds tenants by civil ID to warn about duplicates while creating. */
export async function findTenantByCivilId(civil: string) {
  const db = await supabaseServer();
  const { data } = await db
    .from("tenants")
    .select("id, full_name")
    .eq("civil_id", civil.replace(/\D/g, ""))
    .limit(1)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------- categories & beneficiaries
export async function saveCategory(id: string | null, input: z.input<typeof categorySchema>) {
  return run(async () => {
    const ctx = await requireActionContext("manage_expenses");
    const d = categorySchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name_ar: d.nameAr,
      name_en: d.nameEn,
      type: d.type,
      active: d.active,
    };
    const res = id
      ? await db.from("expense_categories").update(row).eq("id", id).select("id").single()
      : await db.from("expense_categories").insert(row).select("id").single();
    if (res.error) throw res.error;
    reval();
    return res.data.id;
  });
}

export async function saveBeneficiary(id: string | null, input: z.input<typeof beneficiarySchema>) {
  return run(async () => {
    const ctx = await requireActionContext("manage_expenses");
    const d = beneficiarySchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name: d.name,
      kind: d.kind,
      phone: d.phone,
      monthly_salary_fils: d.monthlySalaryFils ?? null,
      notes: d.notes,
      active: d.active,
    };
    const res = id
      ? await db.from("beneficiaries").update(row).eq("id", id).select("id, name").single()
      : await db.from("beneficiaries").insert(row).select("id, name").single();
    if (res.error) throw res.error;
    reval();
    return res.data;
  });
}
