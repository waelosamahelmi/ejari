import { notFound } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { CollectionReceipt } from "@/components/print/collection-receipt";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; lang?: string; auto?: string }>;
}) {
  const sp = await searchParams;
  const parsed = z.array(z.string().uuid()).min(1).max(100).safeParse(sp.ids?.split(","));
  if (!parsed.success) notFound();
  const { ctx, lang } = await requirePrintContext(sp.lang);
  const db = await supabaseServer();
  const { data, error } = await db
    .from("collection_receipts")
    .select("*")
    .eq("org_id", ctx.orgId)
    .in("id", parsed.data);
  if (error) throw error;
  if (!data || data.length !== new Set(parsed.data).size) notFound();
  const receipts = parsed.data.map((id) => data.find((r) => r.id === id)!);
  return (
    <>
      <PrintToolbar
        auto={sp.auto === "1"}
        lang={lang}
        labels={{
          print: lang === "ar" ? "طباعة" : "Print",
          close: lang === "ar" ? "إغلاق" : "Close",
        }}
        documents={{ kind: "collection", ids: parsed.data }}
      />
      <style>{`@page{size:A4 portrait;margin:10mm}.prepared-receipt{padding:8mm;border:1px dashed #888;break-inside:avoid;min-height:125mm;box-sizing:border-box}.receipt-batch{width:190mm;margin:20px auto;background:white}@media print{.receipt-batch{width:auto;margin:0}.prepared-receipt:nth-child(2n):not(:last-child){break-after:page}}`}</style>
      <main className="receipt-batch">
        {receipts.map((r) => (
          <CollectionReceipt
            key={r.id}
            number={r.document_no}
            amount={r.amount_fils}
            snapshot={r.snapshot as Parameters<typeof CollectionReceipt>[0]["snapshot"]}
            status={r.status}
            lang={lang}
          />
        ))}
      </main>
    </>
  );
}
