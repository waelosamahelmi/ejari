"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { maskCivilId, normalizePhone } from "@/domain/validation";
import { normalizeDigits } from "@/domain/money";

export interface SearchHit {
  kind: "tenant" | "unit" | "contract" | "receipt" | "voucher" | "property";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Global search for the command palette (RLS-scoped). */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const ctx = await requireActionContext();
  const q = normalizeDigits(query).trim();
  if (q.length < 1) return [];
  const supabase = await supabaseServer();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const digits = normalizePhone(q);
  const [tenants, units, contracts, receipts, vouchers, properties] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, full_name, civil_id, phones")
      .or(`full_name.ilike.${like},civil_id.ilike.${like}${digits.length >= 4 ? `,phones.cs.{${digits}}` : ""}`)
      .limit(6),
    supabase.from("units").select("id, label, properties(name)").ilike("label", like).limit(6),
    supabase.from("contracts").select("id, contract_no, tenants(full_name)").ilike("contract_no", like).limit(6),
    supabase.from("payments").select("id, receipt_no, system_no, amount_fils, tenants(full_name)").or(`receipt_no.ilike.${like},system_no.ilike.${like}`).limit(6),
    can(ctx.role, "view_expenses")
      ? supabase.from("expense_vouchers").select("id, voucher_no, recipient_name").ilike("voucher_no", like).limit(6)
      : Promise.resolve({ data: [] as { id: string; voucher_no: string; recipient_name: string | null }[] }),
    supabase.from("properties").select("id, name, area").or(`name.ilike.${like},name_en.ilike.${like},area.ilike.${like}`).limit(5),
  ]);
  const hits: SearchHit[] = [];
  for (const p of properties.data ?? []) hits.push({ kind: "property", id: p.id, title: p.name, subtitle: p.area ?? "", href: `/properties/${p.id}` });
  for (const t of tenants.data ?? [])
    hits.push({ kind: "tenant", id: t.id, title: t.full_name, subtitle: [maskCivilId(t.civil_id), t.phones?.[0]].filter(Boolean).join(" · "), href: `/tenants/${t.id}` });
  for (const u of units.data ?? [])
    hits.push({ kind: "unit", id: u.id, title: u.label, subtitle: (u.properties as unknown as { name: string } | null)?.name ?? "", href: `/units/${u.id}` });
  for (const c of contracts.data ?? [])
    hits.push({ kind: "contract", id: c.id, title: c.contract_no, subtitle: (c.tenants as unknown as { full_name: string } | null)?.full_name ?? "", href: `/contracts/${c.id}` });
  for (const r of receipts.data ?? [])
    hits.push({ kind: "receipt", id: r.id, title: r.receipt_no ?? r.system_no ?? "", subtitle: (r.tenants as unknown as { full_name: string } | null)?.full_name ?? "", href: `/payments/${r.id}` });
  for (const v of vouchers.data ?? []) hits.push({ kind: "voucher", id: v.id, title: v.voucher_no, subtitle: v.recipient_name ?? "", href: `/expenses/${v.id}` });
  return hits;
}
