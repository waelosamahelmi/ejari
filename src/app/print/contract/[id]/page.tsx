import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { loadParties, loadTemplate, renderWith, varsInput } from "@/server/queries/contracts";
import { ContractDocument } from "@/components/print/contract-document";
import { Letterhead, PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { PUBLIC_ENV } from "@/lib/env";
import type { RenderedContract } from "@/domain/templates";

export const metadata = { title: "عقد إيجار" };

export default async function PrintContract({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; auto?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, logoUrl, lang } = await requirePrintContext(sp.lang);
  const t = await getTranslations({ locale: lang, namespace: "common.actions" });
  const db = await supabaseServer();
  const { data: c } = await db.from("contracts").select("*, contract_units(unit_id)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const parties = await loadParties(db, { ownerId: c.owner_id, tenantId: c.tenant_id, propertyId: c.property_id, unitIds: (c.contract_units ?? []).map((u) => u.unit_id) });
  let rendered = c.rendered_clauses as unknown as RenderedContract | null;
  if (!rendered || c.status === "draft") {
    const tpl = await loadTemplate(db, c.type, c.template_id);
    rendered = renderWith(
      tpl,
      varsInput(
        {
          contractNo: c.contract_no,
          type: c.type,
          contractDate: c.contract_date,
          startDate: c.start_date,
          firstCollectionDate: c.first_collection_date,
          endDate: c.end_date,
          termMonths: c.term_months,
          autoRenew: c.auto_renew,
          monthlyRentFils: c.monthly_rent_fils,
          purpose: c.purpose,
          utilitiesParty: c.utilities_party,
          electricityFixedFils: c.electricity_fixed_fils,
          freeMonths: c.free_months,
          noticePeriodMonths: c.notice_period_months,
          securityDepositFils: c.security_deposit_fils,
        },
        parties,
      ),
      (c.clause_overrides ?? {}) as { enabled?: Record<string, boolean>; text?: Record<string, string> },
      (c.custom_clauses ?? []) as { key: string; text: string }[],
    );
  }
  const qr = await QRCode.toDataURL(`${PUBLIC_ENV.appUrl}/ar/contracts/${c.id}`, { margin: 0, width: 128, errorCorrectionLevel: "M" });
  return (
    <>
      <PrintToolbar auto={sp.auto === "1"} lang="ar" labels={{ print: t("print"), close: t("close") }} />
      <div className="print-page">
        <ContractDocument
          rendered={rendered}
          contractNo={c.status === "draft" ? "—" : c.contract_no}
          ownerName={parties.owner.name}
          tenantName={parties.tenant.name}
          qr={qr}
          letterhead={<Letterhead show={ctx.settings.letterhead} orgName={ctx.orgName} orgNameEn={ctx.orgNameEn} logoUrl={logoUrl} />}
        />
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
