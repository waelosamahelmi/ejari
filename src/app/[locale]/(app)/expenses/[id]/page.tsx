import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { voucherFormOptions } from "@/server/queries/expenses";
import { can } from "@/lib/permissions";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { VoucherForm } from "@/components/domain/expenses/voucher-form";
import { VoucherDetailView } from "./voucher-detail-view";
import type { AllocationMode } from "@/domain/expenses";

export default async function VoucherPage({ params }: LocaleParams<{ id: string }>) {
  const { locale, id } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "view_expenses" });
  const db = await supabaseServer();
  const { data: v } = await db
    .from("expense_vouchers")
    .select(
      "*, expense_lines(id, position, amount_fils, category_id, beneficiary_id, description, allocation_mode, expense_categories(name_ar, name_en), beneficiaries(name), expense_allocations(property_id, unit_id, amount_fils, properties(name), units(label)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!v) notFound();
  const t = await getTranslations("expenses");
  const lines = [...(v.expense_lines ?? [])].sort((a, b) => a.position - b.position);
  if (v.status === "draft" && can(ctx.role, "manage_expenses")) {
    const opts = await voucherFormOptions(ctx, v.voucher_date);
    return (
      <>
        <LargeTitleHeader
          title={t("edit")}
          subtitle={v.voucher_no}
          back={{ href: "/expenses", label: t("title") }}
        />
        <VoucherForm
          id={v.id}
          {...opts}
          initial={{
            voucherNo: v.voucher_no,
            voucherDate: v.voucher_date,
            paidFrom: v.paid_from,
            reference: v.reference,
            recipientName: v.recipient_name,
            notes: v.notes,
            lines: lines.map((l) => ({
              amountFils: l.amount_fils,
              categoryId: l.category_id,
              beneficiaryId: l.beneficiary_id,
              description: l.description,
              mode: l.allocation_mode as AllocationMode,
              targets: (l.expense_allocations ?? []).map((a) => ({
                propertyId: a.property_id,
                unitId: a.unit_id,
                amountFils: a.amount_fils,
                percent: l.amount_fils
                  ? Math.round((a.amount_fils / l.amount_fils) * 10000) / 100
                  : 0,
              })),
            })),
          }}
        />
      </>
    );
  }
  return (
    <VoucherDetailView
      canManage={can(ctx.role, "manage_expenses")}
      voucher={{
        id: v.id,
        no: v.voucher_no,
        date: v.voucher_date,
        paidFrom: v.paid_from,
        recipient: v.recipient_name,
        reference: v.reference,
        notes: v.notes,
        status: v.status,
        voidReason: v.void_reason,
        lines: lines.map((l) => ({
          amountFils: l.amount_fils,
          category: (l.expense_categories as unknown as { name_ar: string; name_en: string })[
            locale === "ar" ? "name_ar" : "name_en"
          ],
          beneficiary: (l.beneficiaries as unknown as { name: string } | null)?.name ?? "",
          description: l.description,
          mode: l.allocation_mode as AllocationMode,
          allocations: (l.expense_allocations ?? []).map((a) => ({
            property: (a.properties as unknown as { name: string }).name,
            unit: (a.units as unknown as { label: string } | null)?.label ?? null,
            amountFils: a.amount_fils,
          })),
        })),
      }}
    />
  );
}
