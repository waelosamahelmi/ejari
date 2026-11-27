import type React from "react";
import { fromFils } from "@/domain/money";
import { formatPeriod } from "@/domain/dates";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";

/**
 * Prepared collection slip (A5 / half A4). Fixed bilingual (Arabic + English) document labels,
 * landlord name centered at the top. A prepared slip is NOT proof of payment: the status banner,
 * and the blank collection date / method / collector / signature fields, stay exactly as before.
 */
export function CollectionReceipt({
  number,
  amount,
  snapshot,
  status,
}: {
  number: string;
  amount: number;
  snapshot: {
    ownerName: string;
    tenantName: string;
    propertyName: string;
    unitLabels: string;
    periods: string[];
  };
  status: string;
  lang?: "ar" | "en";
}) {
  const row = (ar: string, en: string, value: React.ReactNode) => (
    <tr>
      <th className="w-[24%] text-start font-semibold">
        {ar}
        <span className="block text-[8pt] font-normal text-neutral-600" dir="ltr">
          {en}
        </span>
      </th>
      <td>{value}</td>
    </tr>
  );
  const dots = "………………………";
  return (
    <article className="prepared-receipt" dir="rtl">
      <header className="mb-2 border-b border-black pb-2 text-center">
        <h2 className="text-[17pt] leading-tight font-bold">{snapshot.ownerName}</h2>
        <p className="text-[10pt]">
          {snapshot.propertyName} · {snapshot.unitLabels}
        </p>
      </header>
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <strong className="num text-[10pt]">
          <bdi>{number}</bdi>
        </strong>
        <h1 className="text-center leading-tight font-bold">
          <span className="block text-[16pt]">وصل تحصيل إيجار</span>
          <span className="block text-[11pt]" dir="ltr">
            RENT COLLECTION RECEIPT
          </span>
        </h1>
        <p className="num ms-auto text-[13pt] font-bold">
          <bdi>{fromFils(amount)}</bdi> د.ك <bdi dir="ltr">(KWD)</bdi>
        </p>
      </div>
      <p className="mb-2 text-center text-[9pt] font-semibold">
        {status === "prepared" ? (
          <>
            مجهز للتحصيل — لا يُثبت السداد إلا بعد توقيع المستلم وتسجيل التحصيل.
            <span className="block" dir="ltr">
              Prepared for collection. Not proof of payment until signed by the collector and the
              collection is recorded.
            </span>
          </>
        ) : status === "void" ? (
          <>ملغى — غير صالح للتحصيل / VOID — not valid for collection</>
        ) : (
          <>تم تسجيل التحصيل / Collection recorded</>
        )}
      </p>
      <table className="print-table w-full text-[10.5pt] leading-5">
        <tbody>
          {row("المستأجر", "Tenant", <strong>{snapshot.tenantName}</strong>)}
          {row(
            "المبلغ",
            "Amount",
            <>
              <strong>{tafqeetKWD(amount)}</strong>
              <span className="block text-[9.5pt]" dir="ltr">
                {wordsEN(amount)}
              </span>
            </>,
          )}
          {row(
            "عن الأشهر",
            "For months",
            <>
              {snapshot.periods.map((p) => formatPeriod(p, "ar")).join("، ")}
              <span className="block text-[9.5pt]" dir="ltr">
                {snapshot.periods.map((p) => formatPeriod(p, "en")).join(", ")}
              </span>
            </>,
          )}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[10pt]">
        <p>تاريخ التحصيل / Collection date: …… / …… / …………</p>
        <p>طريقة السداد / Payment method: {dots}</p>
        <p>اسم المستلم / Collector: {dots}</p>
        <p>التوقيع / Signature: {dots}</p>
      </div>
    </article>
  );
}
