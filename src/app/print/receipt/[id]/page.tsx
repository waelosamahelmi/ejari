import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { formatDate, formatPeriod } from "@/domain/dates";
import { fullPropertyAddress } from "@/domain/property-address";
import { fromFils, splitDinarFils } from "@/domain/money";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";

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
  searchParams: Promise<{ lang?: string; auto?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, lang } = await requirePrintContext(sp.lang);
  const db = await supabaseServer();
  const { data: p } = await db
    .from("payments")
    .select(
      "*, tenants(full_name), contracts(contract_no, properties(name, governorate, area, block, street, avenue, house_or_plot, paci_no), contract_units(units(label,type))), payment_allocations(amount_fils, charges(period))",
    )
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
  const t = await getTranslations({ locale: lang, namespace: "payments.receipt" });
  const tc = await getTranslations({ locale: lang, namespace: "common.actions" });
  const tMethod = await getTranslations({ locale: lang, namespace: "enums.paymentMethod" });
  const c = p.contracts as unknown as {
    contract_no: string;
    properties: {
      name: string;
      governorate: string | null;
      area: string | null;
      block: string | null;
      street: string | null;
      avenue: string | null;
      house_or_plot: string | null;
      paci_no: string | null;
    };
    contract_units: { units: { label: string; type: import("@/domain/types").UnitType } }[];
  };
  const periods = [
    ...new Set(
      (p.payment_allocations ?? []).map((a) => (a.charges as unknown as { period: string }).period),
    ),
  ].sort();
  const tUnit = await getTranslations({ locale: lang, namespace: "enums.unitType" });
  const { dinars, fils } = splitDinarFils(p.amount_fils);
  const rtl = lang === "ar";
  return (
    <>
      <PrintToolbar
        auto={sp.auto === "1"}
        lang={lang}
        labels={{ print: tc("print"), close: tc("close") }}
      />
      <div className="print-page" style={{ minHeight: "148mm" }} dir={rtl ? "rtl" : "ltr"}>
        <style>{`@page { size: A5 landscape; margin: 10mm; }`}</style>
        <header className="mb-4 border-b border-black pb-4 text-start">
          <h2 className="text-[17pt] font-bold">{c.properties.name}</h2>
          <p className="text-[10pt] leading-6">{fullPropertyAddress(c.properties, lang)}</p>
          <p className="text-[11pt] font-semibold">
            {c.contract_units.map((u) => `${tUnit(u.units.type)} ${u.units.label}`).join("، ")}
          </p>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-4">
          <table className="print-table w-full text-center text-[12pt]">
            <thead>
              <tr>
                <th className="px-4">{t("dinar")}</th>
                <th className="px-4">{t("fils")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="num px-4 font-bold">{dinars.toLocaleString("en")}</td>
                <td className="num px-4 font-bold">{String(fils).padStart(3, "0")}</td>
              </tr>
            </tbody>
          </table>
          <h1 className="text-center text-[20pt] font-bold whitespace-nowrap">{t("title")}</h1>
          <div className="num min-w-0 text-end text-[10pt] leading-6 break-words">
            <div>
              {t("no")}:{" "}
              <strong dir="ltr" className="inline-block">
                {p.receipt_no ?? p.system_no}
              </strong>
            </div>
            <div>
              {t("date")}: {formatDate(p.received_at)}
            </div>
            {p.receipt_no && <div className="text-neutral-500">{p.system_no}</div>}
          </div>
        </div>
        <div className="mt-6 space-y-3 text-[12pt] leading-8">
          <p>
            {t("received")}:{" "}
            <strong>{(p.tenants as unknown as { full_name: string }).full_name}</strong>
          </p>
          <p>
            {t("amount")}:{" "}
            <strong>{rtl ? tafqeetKWD(p.amount_fils) : wordsEN(p.amount_fils)}</strong>{" "}
            <span className="num">({fromFils(p.amount_fils)})</span>
          </p>
          <p>
            {t("for")}: {periods.map((x) => formatPeriod(x, lang)).join(rtl ? "، " : ", ")} —{" "}
            {t("property")} {c.properties.name} · {t("unit")}{" "}
            {c.contract_units.map((u) => u.units.label).join(", ")}
          </p>
          <p>
            {t("method")}: {tMethod(p.method)}
            {p.reference ? ` — ${t("reference")}: ${p.reference}` : ""}
          </p>
        </div>
        <div className="mt-10 flex justify-between text-[11pt]">
          <div>{collector?.display_name}</div>
          <div>
            {t("collector")}:{" "}
            <span className="inline-block w-48 border-b border-dotted border-black" />
          </div>
        </div>
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
