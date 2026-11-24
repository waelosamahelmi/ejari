import { getTranslations } from "next-intl/server";
import { PoweredBy } from "@/components/print/letterhead";
import { formatDate, formatPeriod } from "@/domain/dates";
import { fullPropertyAddress } from "@/domain/property-address";
import { fromFils, splitDinarFils } from "@/domain/money";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";
import type { UnitType } from "@/domain/types";

export interface PaymentReceiptData {
  voided: boolean;
  amount_fils: number;
  receipt_no: string | null;
  system_no: string | null;
  received_at: string;
  method: string;
  reference: string | null;
  tenantName: string;
  periods: string[];
  collectorName: string | null;
  contract: {
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
    contract_units: { units: { label: string; type_label?: string | null; type: UnitType } }[];
  };
}

/** One payment receipt (A5 / half A4): property, number, amount, tenant, periods, method, collector signature. */
export async function PaymentReceiptDocument({
  data,
  lang,
  poweredBy,
}: {
  data: PaymentReceiptData;
  lang: "ar" | "en";
  poweredBy: boolean;
}) {
  const p = data;
  const c = data.contract;
  const collector = data.collectorName ? { display_name: data.collectorName } : null;
  const periods = data.periods;
  const t = await getTranslations({ locale: lang, namespace: "payments.receipt" });
  const tMethod = await getTranslations({ locale: lang, namespace: "enums.paymentMethod" });
  const tUnit = await getTranslations({ locale: lang, namespace: "enums.unitType" });
  const { dinars, fils } = splitDinarFils(p.amount_fils);
  const rtl = lang === "ar";
  return (
    <div className="print-page" style={{ minHeight: "148mm" }} dir={rtl ? "rtl" : "ltr"}>
      {p.voided && (
        <p className="mb-3 text-center text-xl font-bold">
          {lang === "ar" ? "ملغى — لا يثبت السداد" : "VOID — not proof of payment"}
        </p>
      )}
      <header className="mb-4 border-b border-black pb-4 text-start">
        <h2 className="text-[17pt] font-bold">{c.properties.name}</h2>
        <p className="text-[10pt] leading-6">{fullPropertyAddress(c.properties, lang)}</p>
        <p className="text-[11pt] font-semibold">
          {c.contract_units
            .map((u) => `${u.units.type_label || tUnit(u.units.type)} ${u.units.label}`)
            .join("، ")}
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
          {p.receipt_no && p.system_no !== p.receipt_no && (
            <div className="text-neutral-500">{p.system_no}</div>
          )}
        </div>
      </div>
      <div className="mt-6 space-y-3 text-[12pt] leading-8">
        <p>
          {t("received")}: <strong>{p.tenantName}</strong>
        </p>
        <p>
          {t("amount")}: <strong>{rtl ? tafqeetKWD(p.amount_fils) : wordsEN(p.amount_fils)}</strong>{" "}
          <span className="num">({fromFils(p.amount_fils)})</span>
        </p>
        <p>
          {t("for")}: {periods.map((x) => formatPeriod(x, lang)).join(rtl ? "، " : ", ")} —{" "}
          {t("property")} {c.properties.name} · {t("unit")}{" "}
          {c.contract_units.map((u) => u.units.label).join(", ")}
        </p>
        <p>
          {t("method")}: {tMethod(p.method as Parameters<typeof tMethod>[0])}
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
      <PoweredBy show={poweredBy} />
    </div>
  );
}
