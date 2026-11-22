import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrintContext } from "@/server/print";
import { PrintToolbar } from "@/components/print/print-toolbar";
import PrintReceipt from "../receipt/[id]/page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; lang?: string; auto?: string }>;
}) {
  const sp = await searchParams;
  const ids = z.array(z.string().uuid()).min(1).max(100).safeParse(sp.ids?.split(","));
  if (!ids.success) notFound();
  const { lang } = await requirePrintContext(sp.lang);
  const docs = [];
  for (let i = 0; i < ids.data.length; i += 5)
    docs.push(
      ...(await Promise.all(
        ids.data.slice(i, i + 5).map((id) =>
          PrintReceipt({
            params: Promise.resolve({ id }),
            searchParams: Promise.resolve({ lang, embedded: "1" }),
          }),
        ),
      )),
    );
  return (
    <>
      <PrintToolbar
        auto={sp.auto === "1"}
        lang={lang}
        labels={{
          print: lang === "ar" ? "طباعة" : "Print",
          close: lang === "ar" ? "إغلاق" : "Close",
        }}
        documents={{ kind: "payment", ids: ids.data }}
      />
      <main className="payment-batch">
        {docs.map((d, i) => (
          <section key={ids.data[i]}>{d}</section>
        ))}
      </main>
      <style>{`@page{size:A4 portrait;margin:10mm}@media print{.payment-batch .print-page{min-height:125mm!important;padding:5mm!important;border:1px dashed #aaa;break-inside:avoid}.payment-batch>section:nth-child(2n):not(:last-child){break-after:page}}`}</style>
    </>
  );
}
