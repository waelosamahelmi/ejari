import { PoweredBy } from "@/components/print/letterhead";
import { getTranslations } from "next-intl/server";
import type React from "react";
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
  ownerName?: string | null;
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

const METHODS: Record<string, [string, string]> = {
  cash: ["نقدي", "Cash"],
  cheque: ["شيك", "Cheque"],
  check: ["شيك", "Cheque"],
  bank_transfer: ["تحويل بنكي", "Bank transfer"],
  transfer: ["تحويل بنكي", "Bank transfer"],
  knet: ["كي نت", "KNET"],
  card: ["بطاقة", "Card"],
};

/**
 * One payment receipt, A5. Fixed bilingual (Arabic + English) document labels, like the contract:
 * landlord name centered at the top, then a bordered table of Arabic / English label pairs.
 */
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
  const tUnit = await getTranslations({ locale: lang, namespace: "enums.unitType" });
  const tUnitAr = await getTranslations({ locale: "ar", namespace: "enums.unitType" });
  const { dinars, fils } = splitDinarFils(p.amount_fils);
  const method = METHODS[p.method];
  const units = c.contract_units
    .map((u) => `${u.units.type_label || tUnitAr(u.units.type)} ${u.units.label}`)
    .join("، ");
  void tUnit;
  void lang;
  const periodsAr = p.periods.map((x) => formatPeriod(x, "ar")).join("، ");
  const periodsEn = p.periods.map((x) => formatPeriod(x, "en")).join(", ");
  const row = (ar: string, en: string, value: React.ReactNode) => (
    <tr>
      <th className="w-[22%] text-start font-semibold">
        {ar}
        <span className="block text-[8pt] font-normal text-neutral-600" dir="ltr">
          {en}
        </span>
      </th>
      <td>{value}</td>
    </tr>
  );
  return (
    <div className="print-page" style={{ minHeight: "148mm" }} dir="rtl">
      {p.voided && (
        <p className="mb-3 text-center text-xl font-bold">
          ملغى — لا يثبت السداد / VOID — not proof of payment
        </p>
      )}
      <header className="mb-3 border-b border-black pb-3 text-center">
        <h2 className="text-[18pt] leading-tight font-bold">{p.ownerName || c.properties.name}</h2>
        <p className="text-[10pt] leading-5">
          {c.properties.name} · {fullPropertyAddress(c.properties, "ar")}
        </p>
      </header>
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="num text-[10pt] leading-6">
          <div>
            رقم الإيصال / No.:{" "}
            <strong dir="ltr" className="inline-block">
              {p.receipt_no ?? p.system_no}
            </strong>
          </div>
          <div>
            التاريخ / Date: <span className="num">{formatDate(p.received_at)}</span>
          </div>
        </div>
        <h1 className="text-center leading-tight font-bold">
          <span className="block text-[17pt]">إيصال إيجار</span>
          <span className="block text-[12pt] tracking-wide" dir="ltr">
            RENTAL RECEIPT
          </span>
        </h1>
        <table className="print-table num ms-auto w-40 text-center text-[11pt]">
          <thead>
            <tr>
              <th>دينار / KWD</th>
              <th>فلس / Fils</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-bold">{dinars.toLocaleString("en")}</td>
              <td className="font-bold">{String(fils).padStart(3, "0")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <table className="print-table w-full text-[11pt] leading-6">
        <tbody>
          {row("وصلنا من السيد / السادة", "Received from", <strong>{p.tenantName}</strong>)}
          {row(
            "مبلغًا وقدره",
            "The sum of",
            <>
              <strong>{tafqeetKWD(p.amount_fils)}</strong>
              <span className="block text-[10pt]" dir="ltr">
                {wordsEN(p.amount_fils)} ({fromFils(p.amount_fils)} KWD)
              </span>
            </>,
          )}
          {row(
            "طريقة السداد",
            "Payment method",
            <>
              {method ? `${method[0]} / ${method[1]}` : p.method}
              {p.reference ? ` — ${p.reference}` : ""}
            </>,
          )}
          {row(
            "ذلك عن إيجار",
            "Rent for",
            <>
              {units} — {c.properties.name}
              <span className="block text-[10pt]">
                {periodsAr}
                {periodsEn ? ` / ${periodsEn}` : ""}
              </span>
            </>,
          )}
        </tbody>
      </table>
      <div className="mt-8 flex justify-between text-[11pt]">
        <div>{p.collectorName}</div>
        <div>
          توقيع المستلم / Receiver&apos;s signature:{" "}
          <span className="inline-block w-44 border-b border-dotted border-black" />
        </div>
      </div>
      <PoweredBy show={poweredBy} />
    </div>
  );
}
