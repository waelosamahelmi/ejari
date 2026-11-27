import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import {
  ReceiptSheets,
  layoutSwitcher,
  parseReceiptLayout,
} from "@/components/print/receipt-sheets";
import { PaymentReceiptDocument } from "@/components/print/payment-receipt";
import { PrintToolbar } from "@/components/print/print-toolbar";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const t = await getTranslations({
    locale: lang === "en" ? "en" : "ar",
    namespace: "documents.printTitles",
  });
  return { title: t("receipt") };
}

/** Receipt (A5 / half A4): letterhead, receipt no., tenant, unit, periods, method, amount in words, collector signature. */
export default async function PrintReceipt({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; auto?: string; embedded?: string; layout?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, lang } = await requirePrintContext(sp.lang);
  const db = await supabaseServer();
  const { data: p } = await db
    .from("payments")
    .select(
      "*, tenants(full_name), contracts(contract_no, owners(full_name), properties(property_owners(share_pct, owners(full_name)), name, governorate, area, block, street, avenue, house_or_plot, paci_no), contract_units(units(label,type,type_label))), payment_allocations(amount_fils, charges(period))",
    )
    .eq("org_id", ctx.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const { data: collector } = p.collected_by
    ? await db
        .from("org_members")
        .select("display_name")
        .eq("user_id", p.collected_by)
        .maybeSingle()
    : { data: null };
  const tc = await getTranslations({ locale: lang, namespace: "common.actions" });
  const c = p.contracts as unknown as {
    contract_no: string;
    owners: { full_name: string } | null;
    properties: {
      property_owners?: { share_pct: number; owners: { full_name: string } | null }[];
      name: string;
      governorate: string | null;
      area: string | null;
      block: string | null;
      street: string | null;
      avenue: string | null;
      house_or_plot: string | null;
      paci_no: string | null;
    };
    contract_units: {
      units: { label: string; type_label?: string | null; type: import("@/domain/types").UnitType };
    }[];
  };
  const periods = [
    ...new Set(
      (p.payment_allocations ?? []).map((a) => (a.charges as unknown as { period: string }).period),
    ),
  ].sort();
  const body = (
    <>
      <PaymentReceiptDocument
        lang={lang}
        poweredBy={ctx.settings.poweredBy}
        data={{
          ...p,
          tenantName: (p.tenants as unknown as { full_name: string }).full_name,
          ownerName:
            c.owners?.full_name ??
            [...(c.properties.property_owners ?? [])].sort((a, b) => b.share_pct - a.share_pct)[0]
              ?.owners?.full_name ??
            null,
          periods,
          collectorName: collector?.display_name ?? null,
          contract: c,
        }}
      />
    </>
  );
  // Embedded receipts are laid out by the batch route; a single receipt gets the same top-of-sheet layout.
  if (sp.embedded === "1") return body;
  const layout = parseReceiptLayout(sp.layout);
  return (
    <>
      <PrintToolbar
        documents={{ kind: "payment", ids: [id] }}
        auto={sp.auto === "1"}
        lang={lang}
        labels={{ print: tc("print"), close: tc("close") }}
      />
      <ReceiptSheets
        layout={layout}
        switcher={layoutSwitcher(`/print/receipt/${id}`, { lang: sp.lang }, layout, lang)}
        items={[{ key: id, node: body }]}
      />
    </>
  );
}
