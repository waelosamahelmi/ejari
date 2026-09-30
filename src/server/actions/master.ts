"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import {
  beneficiarySchema,
  bulkUnitsSchema,
  categorySchema,
  ownerSchema,
  propertySchema,
  tenantSchema,
  unitSchema,
  type BulkUnitsInput,
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
export async function saveProperty(id: string | null, input: PropertyInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = propertySchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      name: d.name,
      name_en: d.nameEn,
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
    const pid = res.data.id;
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

/** "Add 20 apartments numbered 1–20, floors 1–5, asking rent 300" — spread evenly over floors. */
export async function bulkCreateUnits(input: BulkUnitsInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_master_data");
    const d = bulkUnitsSchema.parse(input);
    const db = await supabaseServer();
    const { data: existing } = await db
      .from("units")
      .select("label, sort_order")
      .eq("property_id", d.propertyId);
    const labels = new Set((existing ?? []).map((u) => u.label));
    let sort = Math.max(0, ...(existing ?? []).map((u) => u.sort_order));
    const floors = Math.max(1, Math.abs(d.floorTo - d.floorFrom) + 1);
    const perFloor = Math.ceil(d.count / floors);
    const step = d.floorTo >= d.floorFrom ? 1 : -1;
    const rows = [];
    for (let i = 0; i < d.count; i++) {
      const label = `${d.prefix ?? ""}${d.startNumber + i}`;
      if (labels.has(label)) throw new ActionError("duplicate");
      rows.push({
        org_id: ctx.orgId,
        property_id: d.propertyId,
        label,
        sort_order: ++sort,
        type: d.type,
        floor: d.floorFrom + Math.floor(i / perFloor) * step,
        asking_rent_fils: d.askingRentFils,
        bedrooms: d.bedrooms ?? null,
      });
    }
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
