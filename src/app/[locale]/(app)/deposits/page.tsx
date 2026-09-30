import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { isValidPeriod, periodOf, todayKuwait } from "@/domain/dates";
import { monthlySummary } from "@/domain/reports";
import { can } from "@/lib/permissions";
import { DepositsView } from "./deposits-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "deposits" });
  return { title: t("title") };
}

export default async function DepositsPage({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ period?: string; owner?: string; tab?: string }> }) {
  const { locale } = await pageLocale(params);
  const sp = await searchParams;
  const ctx = await requireContext(locale, { capability: "view_expenses" });
  const data = await loadOrgData(ctx);
  const period = sp.period && isValidPeriod(sp.period) ? sp.period : periodOf(todayKuwait());
  const owner = sp.owner && data.owners.has(sp.owner) ? sp.owner : null;
  const summary = monthlySummary(data.idx, period, owner ? { ownerId: owner } : {});
  const db = await supabaseServer();
  const base = db.from("cash_reconciliations").select("note").eq("period", period);
  const { data: note } = await (
    owner ? base.eq("owner_id", owner) : base.is("owner_id", null)
  ).maybeSingle();
  const { data: deposits } = await db
    .from("deposits")
    .select(
      "id, deposit_date, amount_fils, destination, owner_id, bank_name, reference, notes, owners(full_name), deposit_properties(property_id, amount_fils, properties(name))",
    )
    .order("deposit_date", { ascending: false });
  return (
    <DepositsView
      tab={sp.tab === "list" ? "list" : "summary"}
      period={period}
      owner={owner}
      owners={[...data.owners.values()].map((o) => ({ id: o.id, name: o.fullName }))}
      properties={data.ds.properties.map((p) => ({ id: p.id, name: p.name }))}
      summary={summary}
      note={note?.note ?? ""}
      canManage={can(ctx.role, "manage_deposits")}
      deposits={(deposits ?? []).map((d) => ({
        id: d.id,
        date: d.deposit_date,
        amountFils: d.amount_fils,
        destination: d.destination,
        ownerId: d.owner_id,
        owner: (d.owners as unknown as { full_name: string } | null)?.full_name ?? "",
        bankName: d.bank_name ?? "",
        reference: d.reference ?? "",
        notes: d.notes ?? "",
        properties: (d.deposit_properties ?? []).map((x) => ({
          propertyId: x.property_id,
          amountFils: x.amount_fils,
          name: (x.properties as unknown as { name: string }).name,
        })),
      }))}
    />
  );
}
