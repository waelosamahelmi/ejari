import type { ReactNode } from "react";

export type ReceiptLayout = "half" | "a5";

export function parseReceiptLayout(v: string | undefined): ReceiptLayout {
  return v === "a5" ? "a5" : "half";
}

/**
 * Page rules shared by every receipt print route.
 *  - half: A4 paper, each receipt owns a fixed half-sheet slot. Slots always start at the top of
 *    the page, a receipt is never split, and the next receipt's header never shows below it.
 *    Two receipts per sheet when printing several; one at the top when printing one.
 *  - a5: A5 landscape paper (or "A5" in the print dialog), one receipt per page.
 */
export function receiptPageCss(layout: ReceiptLayout): string {
  const common = `
.receipt-sheets .receipt-slot>.prepared-receipt,.receipt-sheets .receipt-slot>.print-page{height:100%;min-height:0!important;box-sizing:border-box;margin:0!important;border:1px dashed #888}
.receipt-sheets .receipt-slot>.print-page{padding:4mm 6mm!important;box-shadow:none!important;width:auto!important;display:flex;flex-direction:column}\n.receipt-sheets .receipt-slot>.print-page .mt-10{margin-top:5mm}\n.receipt-sheets .receipt-slot>.print-page .mt-6{margin-top:3mm}\n.receipt-sheets .receipt-slot>.print-page .leading-8{line-height:1.55}\n.receipt-sheets .receipt-slot>.print-page header{margin-bottom:3mm;padding-bottom:2mm}\n.receipt-sheets .receipt-slot>.print-page>:last-child{margin-top:auto}
.receipt-sheets .receipt-slot>.prepared-receipt{padding:6mm}
.receipt-sheets .receipt-sheet{break-inside:avoid}
@media print{html,body{margin:0!important;background:#fff!important}.receipt-sheets{margin:0!important;width:auto!important}.receipt-sheets .receipt-sheet{break-after:page;margin:0!important}.receipt-sheets .receipt-sheet:last-child{break-after:auto}}`;
  if (layout === "a5")
    return `@page{size:A5 landscape;margin:8mm}
.receipt-sheets{width:194mm;margin:16px auto}
.receipt-sheets .receipt-sheet{height:130mm;background:#fff;margin-bottom:16px}
.receipt-sheets .receipt-slot{height:130mm}${common}
@media print{.receipt-sheets .receipt-sheet{height:130mm}}`;
  return `@page{size:A4 portrait;margin:10mm}
.receipt-sheets{width:190mm;margin:16px auto}
.receipt-sheets .receipt-sheet{height:272mm;background:#fff;margin-bottom:16px}
.receipt-sheets .receipt-slot{height:136mm;padding-bottom:2mm;box-sizing:border-box}${common}`;
}

/** Lays receipts out per the chosen layout. `items` are already-rendered receipts. */
export function ReceiptSheets({
  layout,
  items,
  switcher,
}: {
  layout: ReceiptLayout;
  items: { key: string; node: ReactNode }[];
  /** Links to the other layout, shown on screen only. */
  switcher?: { href: string; label: string };
}) {
  const per = layout === "a5" ? 1 : 2;
  const sheets: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += per) sheets.push(items.slice(i, i + per));
  return (
    <>
      <style>{receiptPageCss(layout)}</style>
      {switcher && (
        <p className="no-print text-center text-sm">
          <a className="underline" href={switcher.href}>
            {switcher.label}
          </a>
        </p>
      )}
      <main className="receipt-sheets" data-layout={layout}>
        {sheets.map((sheet) => (
          <section key={sheet[0]!.key} className="receipt-sheet">
            {sheet.map((it) => (
              <div key={it.key} className="receipt-slot">
                {it.node}
              </div>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}

/** Link to the same print route with the other layout. */
export function layoutSwitcher(
  path: string,
  query: Record<string, string | undefined>,
  layout: ReceiptLayout,
  lang: "ar" | "en",
) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v && k !== "auto" && k !== "layout") q.set(k, v);
  q.set("layout", layout === "a5" ? "half" : "a5");
  return {
    href: `${path}?${q.toString()}`,
    label:
      layout === "a5"
        ? lang === "ar"
          ? "طباعة على نصف ورقة A4 (أعلى الصفحة)"
          : "Print on half of an A4 sheet (top of page)"
        : lang === "ar"
          ? "طباعة على ورقة A5"
          : "Print on A5 paper",
  };
}
