import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { isValidPeriod, periodOf, periodEnd, todayKuwait } from "@/domain/dates";
import { ReceiptPreparation } from "./view";
import { fetchAll } from "@/server/db";
export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ period?: string; property?: string }> }) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "record_payment" });
  const sp = await searchParams;
  const period = sp.period && isValidPeriod(sp.period) ? sp.period : periodOf(todayKuwait());
  const db = await supabaseServer();
  const data = await loadOrgData(ctx);
  const [receipts, counts] = await Promise.all([
    fetchAll((a, b) =>
      db
        .from("collection_receipts")
        .select("*")
        .eq("org_id", ctx.orgId)
        .eq("period", period)
        .order("created_at")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("v_document_print_counts")
        .select("document_id,print_count")
        .eq("org_id", ctx.orgId)
        .eq("kind", "collection")
        .range(a, b),
    ),
  ]);
  const eligible = data.ds.contracts.filter(
    (c) =>
      ["active", "notice_given"].includes(c.status) &&
      c.startDate <= periodEnd(period) &&
      (c.moveOutDate ?? c.endDate) >= period + "-01" &&
      c.unitIds.some((id) => data.units.get(id)),
  );
  const eligibleIds = eligible.map((c) => c.id);
  if (eligibleIds.length) {
    const { ensureChargesUntil } = await import("@/server/billing/ensure-charges");
    await ensureChargesUntil(ctx.orgId, period, ctx.settings, eligibleIds);
  }
  const balances = eligibleIds.length
    ? await fetchAll((a, b) =>
        db
          .from("v_charge_balances")
          .select("contract_id,outstanding_fils")
          .in("contract_id", eligibleIds)
          .lte("period", period)
          .gt("outstanding_fils", 0)
          .range(a, b),
      )
    : [];
  const candidates = eligible
    .map((c) => ({
      id: c.id,
      propertyId: c.propertyId,
      propertyName: data.properties.get(c.propertyId)?.name ?? "",
      tenant: c.tenantName,
      units: c.unitIds.map((id) => data.units.get(id)?.label).join("، "),
      amountFils: balances
        .filter((b) => b.contract_id === c.id)
        .reduce((s, b) => s + (b.outstanding_fils ?? 0), 0),
    }))
    .filter((c) => c.amountFils > 0);
  return (
    <ReceiptPreparation
      period={period}
      property={sp.property ?? "all"}
      candidates={candidates}
      properties={data.ds.properties.map((p) => ({ id: p.id, name: p.name }))}
      receipts={(receipts ?? []).map((r) => ({
        ...r,
        printCount: Number(counts?.find((p) => p.document_id === r.id)?.print_count ?? 0),
      }))}
    />
  );
}
