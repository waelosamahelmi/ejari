import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { periodOf, todayKuwait } from "@/domain/dates";
import type { SessionContext } from "@/lib/auth";

/** Options for the voucher editor: categories, beneficiaries, properties with unit counts and expected rent. */
export async function voucherFormOptions(_ctx: SessionContext, date = todayKuwait()) {
  const db = await supabaseServer();
  const [{ data: cats }, { data: bens }, { data: props }, { data: summary }] = await Promise.all([
    db.from("expense_categories").select("id, name_ar, name_en").eq("active", true).order("name_ar"),
    db.from("beneficiaries").select("id, name").eq("active", true).order("name"),
    db.from("properties").select("id, name, units(id, label, sort_order, active)").eq("active", true).order("name"),
    db.from("v_property_month_summary").select("property_id, expected_fils").eq("period", periodOf(date)),
  ]);
  return {
    categories: (cats ?? []).map((c) => ({ id: c.id, nameAr: c.name_ar, nameEn: c.name_en })),
    beneficiaries: (bens ?? []).map((b) => ({ id: b.id, name: b.name })),
    properties: (props ?? []).map((p) => {
      const units = (p.units ?? []).filter((u) => u.active).sort((a, b) => a.sort_order - b.sort_order);
      return { id: p.id, name: p.name, unitCount: units.length, expectedRentFils: (summary ?? []).find((s) => s.property_id === p.id)?.expected_fils ?? 0, units: units.map((u) => ({ id: u.id, label: u.label })) };
    }),
  };
}
