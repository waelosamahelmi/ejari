import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePrintContext } from "@/server/print";
import { loadOrgData } from "@/server/queries/dataset";
import { monthlyStatement } from "@/domain/reports";
import { formatPeriod, isValidPeriod } from "@/domain/dates";
import { StatementPrint } from "@/components/print/statement-print";
import { Letterhead, PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const metadata = { title: "بيان بالإيرادات والمصروفات" };

export default async function PrintStatement({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string; period: string }>;
  searchParams: Promise<{ lang?: string; auto?: string }>;
}) {
  const { propertyId, period } = await params;
  const sp = await searchParams;
  if (!isValidPeriod(period)) notFound();
  const { ctx, logoUrl, lang } = await requirePrintContext(sp.lang);
  const data = await loadOrgData(ctx);
  if (!data.properties.has(propertyId)) notFound();
  const s = monthlyStatement(data.idx, propertyId, period);
  const t = await getTranslations({ locale: lang, namespace: "collections" });
  const tc = await getTranslations({ locale: lang, namespace: "common" });
  const labels = {
    title: t("statementTitle"),
    property: tc("labels.property"),
    owner: t("owner"),
    from: t("from"),
    to: t("to"),
    unit: t("columns.unit"),
    tenant: t("columns.tenant"),
    legal: t("columns.legal"),
    rent: t("columns.rent"),
    receipts: t("columns.receipts"),
    collected: t("columns.collected"),
    prevNext: t("columns.prevNext"),
    lastPayment: t("columns.lastPayment"),
    arrears: t("columns.arrears"),
    notes: t("columns.notes"),
    vacant: t("vacant"),
    prev: t("prev"),
    next: t("next"),
    free: t("free"),
    notice: t("notice"),
    total: t("totals.total"),
    recipient: t("recipient"),
    signature: t("signature"),
  };
  return (
    <>
      <PrintToolbar
        auto={sp.auto === "1"}
        lang={lang}
        labels={{ print: tc("actions.print"), close: tc("actions.close") }}
      />
      <div className="print-page landscape" dir={lang === "ar" ? "rtl" : "ltr"}>
        <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
        <Letterhead
          show={ctx.settings.letterhead}
          orgName={ctx.orgName}
          orgNameEn={ctx.orgNameEn}
          logoUrl={logoUrl}
        />
        <StatementPrint s={s} labels={labels} monthTitle={formatPeriod(period, lang)} />
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
