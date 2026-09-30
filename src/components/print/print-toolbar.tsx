"use client";
import { useEffect } from "react";
import { Printer, X } from "lucide-react";

/** Screen-only toolbar for print routes; `auto` triggers the browser print dialog (the "Download PDF" path). */
export function PrintToolbar({
  auto,
  labels,
  lang,
}: {
  auto: boolean;
  labels: { print: string; close: string };
  lang: "ar" | "en";
}) {
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto, lang]);
  return (
    <div className="no-print sticky top-0 z-10 flex justify-center gap-2 py-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex h-11 items-center gap-2 rounded-full bg-[#0E0F12] px-5 text-[15px] font-semibold text-white shadow-lg"
      >
        <Printer className="size-[18px]" />
        {labels.print}
      </button>
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
        className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold shadow-lg"
      >
        <X className="size-[18px]" />
        {labels.close}
      </button>
    </div>
  );
}
