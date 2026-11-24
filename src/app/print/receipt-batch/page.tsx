import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePrintContext } from "@/server/print";
import { PrintToolbar } from "@/components/print/print-toolbar";
import PrintReceipt from "../receipt/[id]/page";
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
  const ids = z.array(z.string().uuid()).min(1).max(100).safeParse(sp.ids?.split(","));
  if (!ids.success) notFound();
  const { lang } = await requirePrintContext(sp.lang);
  const layout = parseReceiptLayout(sp.layout);
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
      <ReceiptSheets
        layout={layout}
        switcher={layoutSwitcher(
          "/print/receipt-batch",
          { ids: sp.ids, lang: sp.lang },
          layout,
          lang,
        )}
        items={docs.map((d, i) => ({ key: ids.data[i]!, node: d }))}
      />
    </>
  );
}
