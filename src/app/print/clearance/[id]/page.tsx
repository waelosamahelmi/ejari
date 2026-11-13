import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { clearanceSnapshotSchema } from "@/domain/clearance";
import { fullPropertyAddress } from "@/domain/property-address";
import { formatDate } from "@/domain/dates";
import { getTranslations } from "next-intl/server";
export const metadata = { title: "طلب تنازل وإخلاء" };
export default async function ClearancePrint({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { lang } = await requirePrintContext(sp.lang);
  const db = await supabaseServer();
  const { data } = await db
    .from("contract_clearances")
    .select("snapshot,issued_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const d = clearanceSnapshotSchema.parse(data.snapshot);
  const te = await getTranslations({ locale: lang, namespace: "enums.unitType" });
  const ar = lang === "ar";
  const text = (a: string, e: string) => (ar ? a : e);
  return (
    <>
      <PrintToolbar
        auto={false}
        lang={lang}
        labels={{ print: text("طباعة", "Print"), close: text("إغلاق", "Close") }}
      />
      <article
        className="print-page clearance-doc"
        dir={ar ? "rtl" : "ltr"}
        style={{ fontSize: "12pt", lineHeight: 1.8 }}
      >
        <header className="mb-8 text-center">
          <h1 className="text-xl font-bold underline">{d.ownerNames.join(" / ")}</h1>
          <h2 className="mt-3 text-xl font-bold underline">
            {text("طلب تنازل وإخلاء", "Vacating and surrender request")}
          </h2>
        </header>
        <p>
          {text("السيد /", "To:")} {d.ownerNames.join(" / ")} — {text("المحترم", "Owner")}
        </p>
        <p className="mt-4">{text("تحية طيبة وبعد،،،", "Greetings,")}</p>
        <p className="mt-4">
          {text(
            "أرجو التكرم بالموافقة على قبول تنازلي وإخلائي عن:",
            "Please accept my request to surrender and vacate:",
          )}
        </p>
        <p className="font-semibold">{d.units.map((u) => `${te(u.type)} ${u.label}`).join("، ")}</p>
        <p>
          {text("العقار:", "Property:")} {d.propertyName}
        </p>
        <p>{fullPropertyAddress(d.address, lang)}</p>
        <p>
          {text("رقم العقد:", "Lease number:")} <bdi>{d.contractNo}</bdi>
        </p>
        <p className="mt-5">
          {text("وذلك اعتبارًا من:", "Effective move-out date:")}{" "}
          <bdi>{formatDate(d.moveOutDate)}</bdi>
        </p>
        <p>
          {text("آخر سداد مسجل بتاريخ:", "Last recorded payment date:")}{" "}
          <bdi>{d.lastPaymentDate ? formatDate(d.lastPaymentDate) : "……………………"}</bdi>
        </p>
        <p className="mt-4">
          {text(
            "إقرار المستأجر بتسوية الكهرباء والماء وإرفاق براءة الذمة:",
            "Tenant declaration of utility settlement and supporting clearance:",
          )}{" "}
          □ {text("نعم", "Yes")}　□ {text("لا", "No")}
        </p>
        <p className="mt-4">
          {text(
            "هذا طلب إخلاء؛ توقيع المالك أدناه يثبت موافقته. لا يُعد تاريخ آخر دفعة وحده إثباتًا لسداد جميع المستحقات.",
            "This is a vacating request; the owner's signature below records approval. The last payment date alone does not certify that all dues are settled.",
          )}
        </p>
        <section className="mt-8 break-inside-avoid">
          <p className="text-center">{text("وتفضلوا بقبول وافر التحية،،،", "Yours faithfully,")}</p>
          {d.tenantNames.map((name) => (
            <div key={name} className="mt-4">
              <p>
                {text("اسم المستأجر:", "Tenant:")} {name}
              </p>
              <p>{text("التوقيع:", "Signature:")} ………………………………</p>
            </div>
          ))}
          <p className="mt-5">
            {text("تحريرًا في:", "Issued on:")} <bdi>{formatDate(data.issued_at)}</bdi>
          </p>
          <hr className="my-5" />
          <p className="font-bold">{text("موافقة المالك:", "Owner approval:")}</p>
          <p>………………………………………………………………</p>
          <p>{text("التوقيع:", "Signature:")} ………………………………</p>
        </section>
      </article>
    </>
  );
}
