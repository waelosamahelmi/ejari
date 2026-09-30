import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { Letterhead, PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { formatDate, formatPeriod } from "@/domain/dates";
import { fromFils, splitDinarFils } from "@/domain/money";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";

export const metadata = { title: "سند قبض" };

/** Receipt (A5 / half A4): letterhead, receipt no., tenant, unit, periods, method, amount in words, collector signature. */
export default async function PrintReceipt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; auto?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, logoUrl, lang } = await requirePrintContext(sp.lang);
  const db = await supabaseServer();
  const { data: p } = await db
    .from("payments")
    .select("*, tenants(full_name), contracts(contract_no, properties(name), contract_units(units(label))), payment_allocations(amount_fils, charges(period))")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  const { data: collector } = p.collected_by ? await db.from("org_members").select("display_name").eq("user_id", p.collected_by).maybeSingle() : { data: null };
  const t = await getTranslations({ locale: lang, namespace: "payments.receipt" });
  const tc = await getTranslations({ locale: lang, namespace: "common.actions" });
  const tMethod = await getTranslations({ locale: lang, namespace: "enums.paymentMethod" });
  const c = p.contracts as unknown as { contract_no: string; properties: { name: string }; contract_units: { units: { label: string } }[] };
  const periods = [...new Set((p.payment_allocations ?? []).map((a) => (a.charges as unknown as { period: string }).period))].sort();
  const { dinars, fils } = splitDinarFils(p.amount_fils);
  const rtl = lang === "ar";
  return (
    <>
      <PrintToolbar auto={sp.auto === "1"} lang={lang} labels={{ print: tc("print"), close: tc("close") }} />
      <div className="print-page" style={{ minHeight: "148mm" }} dir={rtl ? "rtl" : "ltr"}>
        <style>{`@page { size: A5 landscape; margin: 10mm; }`}</style>
        <Letterhead show={ctx.settings.letterhead} orgName={ctx.orgName} orgNameEn={ctx.orgNameEn} logoUrl={logoUrl} />
        <div className="flex items-start justify-between">
          <table className="print-table w-auto text-center text-[12pt]">
            <thead><tr><th className="px-4">{t("dinar")}</th><th className="px-4">{t("fils")}</th></tr></thead>
            <tbody><tr><td className="num px-4 font-bold">{dinars.toLocaleString("en")}</td><td className="num px-4 font-bold">{String(fils).padStart(3, "0")}</td></tr></tbody>
          </table>
          <h1 className="text-[20pt] font-bold">{t("title")}</h1>
          <div className="num text-[10pt]">
            <div>{t("no")}: <strong>{p.receipt_no ?? p.system_no}</strong></div>
            <div>{t("date")}: {formatDate(p.received_at)}</div>
            {p.receipt_no && <div className="text-neutral-500">{p.system_no}</div>}
          </div>
        </div>
        <div className="mt-6 space-y-3 text-[12pt] leading-8">
          <p>{t("received")}: <strong>{(p.tenants as unknown as { full_name: string }).full_name}</strong></p>
          <p>{t("amount")}: <strong>{rtl ? tafqeetKWD(p.amount_fils) : wordsEN(p.amount_fils)}</strong> <span className="num">({fromFils(p.amount_fils)})</span></p>
          <p>{t("for")}: {periods.map((x) => formatPeriod(x, lang)).join(rtl ? "، " : ", ")} — {t("property")} {c.properties.name} · {t("unit")} {c.contract_units.map((u) => u.units.label).join(", ")}</p>
          <p>{t("method")}: {tMethod(p.method)}{p.reference ? ` — ${t("reference")}: ${p.reference}` : ""}</p>
        </div>
        <div className="mt-10 flex justify-between text-[11pt]">
          <div>{collector?.display_name}</div>
          <div>{t("collector")}: <span className="inline-block w-48 border-b border-dotted border-black" /></div>
        </div>
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
