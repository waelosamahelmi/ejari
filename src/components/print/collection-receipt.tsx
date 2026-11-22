import { fromFils } from "@/domain/money";
import { formatPeriod } from "@/domain/dates";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";
export function CollectionReceipt({
  number,
  amount,
  snapshot,
  status,
  lang,
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
  lang: "ar" | "en";
}) {
  const ar = lang === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  return (
    <article className="prepared-receipt" dir={ar ? "rtl" : "ltr"}>
      <header className="mb-4 border-b border-black pb-3">
        <h2 className="text-xl font-bold">{snapshot.ownerName}</h2>
        <p>
          {snapshot.propertyName} · {snapshot.unitLabels}
        </p>
      </header>
      <div className="mb-4 flex justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("وصل تحصيل إيجار", "Rent collection receipt")}</h1>
        <strong>
          <bdi>{number}</bdi>
        </strong>
      </div>
      <p className="mb-3 text-sm font-semibold">
        {status === "prepared"
          ? t(
              "مجهز للتحصيل — لا يُثبت السداد إلا بعد توقيع المستلم وتسجيل التحصيل.",
              "Prepared for collection — payment requires the collector's signature and a recorded payment.",
            )
          : status === "void"
            ? t("ملغى — غير صالح للتحصيل", "VOID — not valid for collection")
            : t("تم تسجيل التحصيل", "Collection recorded")}
      </p>
      <p>
        {t("المستأجر:", "Tenant:")} <strong>{snapshot.tenantName}</strong>
      </p>
      <p className="num my-2 text-xl font-bold">
        {fromFils(amount)} {t("د.ك", "KWD")}
      </p>
      <p>{ar ? tafqeetKWD(amount) : wordsEN(amount)}</p>
      <p className="mt-3">
        {t("عن الأشهر:", "For months:")}{" "}
        {snapshot.periods.map((p) => formatPeriod(p, lang)).join("، ")}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <p>{t("تاريخ التحصيل:", "Collection date:")} …… / …… / …………</p>
        <p>{t("طريقة السداد:", "Payment method:")} ………………………</p>
        <p>{t("اسم المستلم:", "Collector:")} ………………………</p>
        <p>{t("التوقيع:", "Signature:")} ………………………</p>
      </div>
    </article>
  );
}
