import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { signPath } from "@/server/storage";
import { PaymentDetailView } from "./payment-detail-view";

export default async function PaymentPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale);
  const db = await supabaseServer();
  const { data: p } = await db
    .from("payments")
    .select(
      "*, tenants(id, full_name), contracts(id, contract_no, properties(name), contract_units(units(label))), payment_allocations(amount_fils, charges(period, kind))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const { data: att } = await db
    .from("attachments")
    .select("path, bucket, file_name")
    .eq("entity_type", "payment")
    .eq("entity_id", id)
    .limit(1)
    .maybeSingle();
  const { data: collector } = p.collected_by
    ? await db
        .from("org_members")
        .select("display_name")
        .eq("user_id", p.collected_by)
        .maybeSingle()
    : { data: null };
  const c = p.contracts as unknown as {
    id: string;
    contract_no: string;
    properties: { name: string };
    contract_units: { units: { label: string } }[];
  };
  const allocated = (p.payment_allocations ?? []).reduce((a, x) => a + x.amount_fils, 0);
  return (
    <PaymentDetailView
      canVoid={can(ctx.role, "void_payment")}
      payment={{
        id: p.id,
        receiptNo: p.receipt_no,
        systemNo: p.system_no,
        amountFils: p.amount_fils,
        method: p.method,
        date: p.received_at,
        reference: p.reference,
        notes: p.notes,
        voided: p.voided,
        voidReason: p.void_reason,
        tenantId: (p.tenants as unknown as { id: string }).id,
        tenant: (p.tenants as unknown as { full_name: string }).full_name,
        contractId: c.id,
        contractNo: c.contract_no,
        unit: `${c.properties.name} · ${c.contract_units.map((u) => u.units.label).join(", ")}`,
        collector: collector?.display_name ?? "",
        allocations: (p.payment_allocations ?? [])
          .map((a) => ({
            amountFils: a.amount_fils,
            period: (a.charges as unknown as { period: string }).period,
            kind: (a.charges as unknown as { kind: string }).kind,
          }))
          .sort((a, b) => a.period.localeCompare(b.period)),
        creditFils: p.voided ? 0 : p.amount_fils - allocated,
        attachmentUrl: att ? await signPath(att.bucket as "receipts", att.path) : null,
      }}
    />
  );
}
