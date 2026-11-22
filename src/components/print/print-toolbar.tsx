"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Printer, X } from "lucide-react";
import { recordPrint } from "@/server/actions/collection-receipts";
/** Counts print requests, not physical pages or printer success. */
export function PrintToolbar({
  auto,
  labels,
  lang,
  documents,
}: {
  auto: boolean;
  labels: { print: string; close: string };
  lang: "ar" | "en";
  documents?: { kind: "payment" | "collection" | "voucher"; ids: string[] };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const controlled = useRef(false);
  const autoDone = useRef(false);
  const identity = documents ? JSON.stringify(documents) : "";
  const request = useCallback(async () => {
    if (controlled.current) return;
    controlled.current = true;
    autoDone.current = true;
    setBusy(true);
    setError(false);
    try {
      if (identity) {
        const d = JSON.parse(identity) as NonNullable<typeof documents>;
        const r = await recordPrint(d.kind, d.ids, crypto.randomUUID());
        if (!r.ok) {
          setError(true);
          return;
        }
      }
      await document.fonts.ready;
      window.print();
    } finally {
      controlled.current = false;
      setBusy(false);
    }
  }, [identity]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (auto && !autoDone.current) {
      const t = setTimeout(() => {
        if (!autoDone.current) void request();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [auto, lang, request]);
  useEffect(() => {
    const native = () => {
      if (controlled.current || !identity) return;
      const d = JSON.parse(identity) as NonNullable<typeof documents>;
      void recordPrint(d.kind, d.ids, crypto.randomUUID()).then((r) => {
        if (!r.ok) setError(true);
      });
    };
    window.addEventListener("beforeprint", native);
    return () => window.removeEventListener("beforeprint", native);
  }, [identity]);
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap justify-center gap-2 py-3">
      <button
        disabled={busy}
        onClick={() => void request()}
        className="flex h-11 items-center gap-2 rounded-full bg-[#0E0F12] px-5 text-[15px] font-semibold text-white shadow-lg disabled:opacity-50"
      >
        <Printer className="size-[18px]" />
        {labels.print}
      </button>
      <button
        onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
        className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold shadow-lg"
      >
        <X className="size-[18px]" />
        {labels.close}
      </button>
      {error && (
        <p role="alert" className="w-full text-center text-red-700">
          {lang === "ar"
            ? "تعذر تسجيل طلب الطباعة. أعد المحاولة مع الاتصال بالإنترنت."
            : "Could not record the print request. Reconnect and retry."}
        </p>
      )}
    </div>
  );
}
