import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePrintContext } from "@/server/print";
import { loadOrgData } from "@/server/queries/dataset";
import { supabaseServer } from "@/lib/supabase/server";
import { Letterhead, PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { formatPeriod, isValidPeriod } from "@/domain/dates";
import { fromFils } from "@/domain/money";
import { monthlySummary } from "@/domain/reports";

export const metadata = { title: "الملخص الشهري" };

/** Monthly cover sheet (§6.8) with per-property breakdown and reconciliation. */
export default async function PrintSummary({ params, searchParams }: { params: Promise<{ period: string }>; searchParams: Promise<{ lang?: string; owner?: string; auto?: string }> }) {
  const { period } = await params;
  const sp = await searchParams;
  if (!isValidPeriod(period)) notFound();
  const { ctx, logoUrl, lang } = await requirePrintContext(sp.lang);
  const data = await loadOrgData(ctx);
  const s = monthlySummary(data.idx, period, sp.owner ? { ownerId: sp.owner } : {});
  const db = await supabaseServer();
  const base = db.from("cash_reconciliations").select("note").eq("period", period);
  const { data: note } = await (sp.owner ? base.eq("owner_id", sp.owner) : base.is("owner_id", null)).maybeSingle();
  const t = await getTranslations({ locale: lang, namespace: "deposits.summary" });
  const tc = await getTranslations({ locale: lang, namespace: "common" });
  const cur = tc("labels.currency");
  return (
    <>
      <PrintToolbar auto={sp.auto === "1"} lang={lang} labels={{ print: tc("actions.print"), close: tc("actions.close") }} />
      <div className="print-page relative overflow-hidden" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:url(/brand/arch-pattern.svg)] [background-size:48px_56px]" />
        <Letterhead show={ctx.settings.letterhead} orgName={ctx.orgName} orgNameEn={ctx.orgNameEn} logoUrl={logoUrl} />
        {sp.owner && <p className="mb-2 text-[11pt]">{t("owner")}: <strong>{data.owners.get(sp.owner)?.fullName}</strong></p>}
        <h1 className="mt-6 text-center text-[18pt] font-bold underline underline-offset-8">{t("heading", { month: formatPeriod(period, lang) })}</h1>
        <table className="mx-auto mt-8 w-[70%] text-[14pt]">
          <tbody>
            {[
              [t("collected"), s.collectedFils],
              [t("deposits"), s.depositsFils],
              [t("expenses"), s.expensesFils],
            ].map(([l, v]) => (
              <tr key={l as string}>
                <td className="py-2">{l}</td>
                <td className="px-3">=</td>
                <td className="num py-2 text-end font-bold">{fromFils(v as number)} {cur}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black">
              <td className="py-2">{t("difference")}</td>
              <td className="px-3">=</td>
              <td className="num py-2 text-end font-bold">{fromFils(s.differenceFils)} {cur}</td>
            </tr>
          </tbody>
        </table>
        {s.differenceFils !== 0 && note?.note && <p className="mx-auto mt-3 w-[70%] text-[11pt] italic">{note.note}</p>}
        <h2 className="mt-10 mb-2 text-[12pt] font-bold">{t("perProperty")}</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>{tc("labels.property")}</th>
              <th>{t("expected")}</th>
              <th>{t("collected")}</th>
              <th>{t("arrears")}</th>
              <th>{t("expenses")}</th>
              <th>{t("net")}</th>
              <th>{t("deposits")}</th>
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.propertyId}>
                <td>{r.propertyName}</td>
                <td className="num text-center">{fromFils(r.expectedFils)}</td>
                <td className="num text-center">{fromFils(r.collectedFils)}</td>
                <td className="num text-center">{fromFils(r.arrearsFils)}</td>
                <td className="num text-center">{fromFils(r.expensesFils)}</td>
                <td className="num text-center">{fromFils(r.netFils)}</td>
                <td className="num text-center">{fromFils(r.depositsFils)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
