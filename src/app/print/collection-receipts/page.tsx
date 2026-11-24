import { notFound } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { CollectionReceipt } from "@/components/print/collection-receipt";
import {
  ReceiptSheets,
  layoutSwitcher,
  parseReceiptLayout,
} from "@/components/print/receipt-sheets";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; lang?: string; auto?: string; layout?: string }>;
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
  const layout = parseReceiptLayout(sp.layout);
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
      <ReceiptSheets
        layout={layout}
        switcher={layoutSwitcher(
          "/print/collection-receipts",
          { ids: sp.ids, lang: sp.lang },
          layout,
          lang,
        )}
        items={receipts.map((r) => ({
          key: r.id,
          node: (
            <CollectionReceipt
              number={r.document_no}
              amount={r.amount_fils}
              snapshot={r.snapshot as Parameters<typeof CollectionReceipt>[0]["snapshot"]}
              status={r.status}
              lang={lang}
            />
          ),
        }))}
      />
    </>
  );
}
